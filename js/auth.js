import { auth, db, useFirebase, ADMIN_EMAILS } from './firebase-config.js';

export let currentUser = null;
export let currentRole = "user";

export async function resolveRole(user) {
  const isHardAdmin = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
  
  if (!useFirebase) {
    return { role: "admin", active: true }; // Local mode
  }
  
  try {
    const doc = await db.collection("jeanic_accounts").doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.active === false) return { role: data.role || "user", active: false };
      return { role: data.role || (isHardAdmin ? "admin" : "user"), active: true };
    }
    
    // First time setup if admin or normal user
    const assignedRole = isHardAdmin ? "admin" : "user";
    await db.collection("jeanic_accounts").doc(user.uid).set({
      email: user.email,
      role: assignedRole,
      employeeId: null,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: "system"
    });
    return { role: assignedRole, active: true };
  } catch (e) {
    console.error("Error resolving role:", e);
    return { role: isHardAdmin ? "admin" : "user", active: true };
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
}

export function setCurrentUser(user, role) {
  currentUser = user;
  currentRole = role;
}
