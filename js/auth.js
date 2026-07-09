import { auth, db, useFirebase, ADMIN_EMAILS } from './firebase-config.js';
import { generateSecretBase32, buildOtpAuthUri, verifyTotp } from './mfa.js';

// ---------------------------------------------------------------------------
// QUAN TRỌNG — Firestore Security Rules cho collection "jeanic_accounts":
// Tài liệu ở đây giờ chứa thêm mfaSecret (khóa bí mật TOTP) và employeeId.
// Nếu rules hiện tại đang mở (cho phép mọi người dùng đã đăng nhập đọc/ghi
// toàn bộ collection), BẮT BUỘC phải siết lại theo hướng: mỗi tài khoản chỉ
// tự đọc/ghi được đúng document của mình (theo uid), và chỉ admin mới được
// đọc toàn bộ danh sách (dùng cho trang Cài đặt > Quản lý tài khoản). Ví dụ:
//
//   match /jeanic_accounts/{uid} {
//     function isSelf() { return request.auth != null && request.auth.uid == uid; }
//     function isAdmin() {
//       return request.auth != null &&
//         get(/databases/$(database)/documents/jeanic_accounts/$(request.auth.uid)).data.role == 'admin';
//     }
//     allow get:  if isSelf() || isAdmin();
//     allow list: if isAdmin();
//     allow write: if isSelf() || isAdmin();
//   }
//
// Thiếu rule này, bất kỳ ai đăng nhập cũng có thể đọc mfaSecret của người
// khác và tự bỏ qua MFA của họ — hãy áp dụng rule trên trong Firebase Console
// (Firestore Database > Rules) trước khi đưa MFA vào sử dụng thật.
// ---------------------------------------------------------------------------

export let currentUser = null;
export let currentRole = "user";
// Full account document for the signed-in user: { employeeId, mfaEnabled, mfaSecret, ... }
export let currentAccount = null;

function accountDefaults(patch) {
  return { employeeId: null, mfaEnabled: false, mfaSecret: null, ...patch };
}

export async function resolveRole(user) {
  const isHardAdmin = ADMIN_EMAILS.includes((user.email || "").toLowerCase());

  if (!useFirebase) {
    return accountDefaults({ role: "admin", active: true }); // Local mode
  }

  try {
    const doc = await db.collection("jeanic_accounts").doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.active === false) {
        return accountDefaults({ role: data.role || "user", active: false, employeeId: data.employeeId || null, mfaEnabled: !!data.mfaEnabled, mfaSecret: data.mfaSecret || null });
      }
      return accountDefaults({
        role: data.role || (isHardAdmin ? "admin" : "user"),
        active: true,
        employeeId: data.employeeId || null,
        mfaEnabled: !!data.mfaEnabled,
        mfaSecret: data.mfaSecret || null
      });
    }

    // First time setup if admin or normal user
    const assignedRole = isHardAdmin ? "admin" : "user";
    await db.collection("jeanic_accounts").doc(user.uid).set({
      email: user.email,
      role: assignedRole,
      employeeId: null,
      active: true,
      mfaEnabled: false,
      mfaSecret: null,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    });
    return accountDefaults({ role: assignedRole, active: true });
  } catch (e) {
    console.error("Error resolving role:", e);
    return accountDefaults({ role: isHardAdmin ? "admin" : "user", active: true });
  }
}

export function getAuthErrorMessage(code) {
  switch (code) {
    case 'auth/user-not-found': return "Tài khoản chưa tồn tại. Vui lòng Tạo tài khoản.";
    case 'auth/wrong-password': return "Sai mật khẩu.";
    case 'auth/email-already-in-use': return "Email này đã được đăng ký. Vui lòng đăng nhập.";
    case 'auth/weak-password': return "Mật khẩu quá yếu (cần ít nhất 6 ký tự).";
    case 'auth/invalid-email': return "Email không hợp lệ.";
    case 'auth/network-request-failed': return "Lỗi mạng. Vui lòng kiểm tra kết nối internet.";
    default: return "Đã xảy ra lỗi: " + code;
  }
}

export async function login(email, pass) {
  if (!useFirebase) throw new Error("offline");
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    return { success: true };
  } catch (e) {
    return { success: false, message: getAuthErrorMessage(e.code) };
  }
}

export async function signup(email, pass) {
  if (!useFirebase) throw new Error("offline");
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    return { success: true, message: "Tạo tài khoản thành công!" };
  } catch (e) {
    return { success: false, message: getAuthErrorMessage(e.code) };
  }
}

export function logout() {
  if (useFirebase && auth.currentUser) {
    auth.signOut();
  } else {
    location.reload();
  }
}

export async function setLocalUser() {
  currentUser = { uid: "local", email: "local@offline" };
  currentRole = "admin";
  currentAccount = accountDefaults({ role: "admin", active: true });
}

export function setCurrentUser(user, role, account) {
  currentUser = user;
  currentRole = role;
  currentAccount = account || accountDefaults({ role, active: true });
}

export async function listAccounts() {
  if (!useFirebase) return { supported: false, accounts: [] };
  try {
    const snap = await db.collection("jeanic_accounts").get();
    const accounts = [];
    snap.forEach(doc => accounts.push({ uid: doc.id, ...doc.data() }));
    accounts.sort((a, b) => (a.email || "").localeCompare(b.email || ""));
    return { supported: true, accounts };
  } catch (e) {
    console.error("Lỗi tải danh sách tài khoản:", e);
    return { supported: true, accounts: [], error: e.message };
  }
}

export async function setAccountRole(uid, role) {
  if (!useFirebase) return false;
  try {
    await db.collection("jeanic_accounts").doc(uid).update({ role });
    return true;
  } catch (e) {
    console.error("Lỗi cập nhật vai trò:", e);
    return false;
  }
}

export async function setAccountActive(uid, active) {
  if (!useFirebase) return false;
  try {
    await db.collection("jeanic_accounts").doc(uid).update({ active });
    return true;
  } catch (e) {
    console.error("Lỗi cập nhật trạng thái tài khoản:", e);
    return false;
  }
}

// ---------- Employee link (self-service portal) ----------
// Links a login account to an employee record so the account holder can see
// only the devices handed over to them under "Thiết bị của tôi".
export async function setAccountEmployeeLink(uid, employeeId) {
  if (!useFirebase) return false;
  try {
    await db.collection("jeanic_accounts").doc(uid).update({ employeeId: employeeId || null });
    return true;
  } catch (e) {
    console.error("Lỗi liên kết tài khoản với nhân viên:", e);
    return false;
  }
}

// ---------- MFA (TOTP) ----------
// Enrollment is a 2-step process: (1) generate a secret and show it as a QR
// code/manual key without turning MFA on yet, (2) once the user proves they
// scanned it correctly by submitting a valid code, mfaEnabled is flipped on.
export async function startMfaEnrollment(uid, email) {
  if (!useFirebase) return { success: false, message: "MFA chỉ khả dụng khi kết nối Firebase (chế độ online)." };
  try {
    const secret = generateSecretBase32();
    const otpauth = buildOtpAuthUri(secret, email || uid, "JEANIC IT");
    await db.collection("jeanic_accounts").doc(uid).update({ mfaPendingSecret: secret });
    return { success: true, secret, otpauth };
  } catch (e) {
    console.error("Lỗi khởi tạo MFA:", e);
    return { success: false, message: "Không thể khởi tạo MFA: " + e.message };
  }
}

export async function confirmMfaEnrollment(uid, secret, token) {
  if (!useFirebase) return { success: false, message: "MFA chỉ khả dụng khi kết nối Firebase (chế độ online)." };
  const ok = await verifyTotp(secret, token);
  if (!ok) return { success: false, message: "Mã xác thực không đúng hoặc đã hết hạn. Vui lòng thử lại." };
  try {
    await db.collection("jeanic_accounts").doc(uid).update({
      mfaEnabled: true,
      mfaSecret: secret,
      mfaPendingSecret: null
    });
    return { success: true };
  } catch (e) {
    console.error("Lỗi bật MFA:", e);
    return { success: false, message: "Không thể lưu cấu hình MFA: " + e.message };
  }
}

export async function disableMfa(uid, secret, token) {
  if (!useFirebase) return { success: false, message: "MFA chỉ khả dụng khi kết nối Firebase (chế độ online)." };
  const ok = await verifyTotp(secret, token);
  if (!ok) return { success: false, message: "Mã xác thực không đúng. Vui lòng thử lại." };
  try {
    await db.collection("jeanic_accounts").doc(uid).update({
      mfaEnabled: false,
      mfaSecret: null,
      mfaPendingSecret: null
    });
    return { success: true };
  } catch (e) {
    console.error("Lỗi tắt MFA:", e);
    return { success: false, message: "Không thể tắt MFA: " + e.message };
  }
}

export async function verifyMfaLoginToken(secret, token) {
  return verifyTotp(secret, token);
}
