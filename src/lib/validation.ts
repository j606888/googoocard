export interface ValidationErrors {
  name?: string;
  email?: string;
  password?: string;
}

const isDevelopment = process.env.NODE_ENV === "development";

export const validateForm = (data: { name?: string; email: string; password: string }): ValidationErrors => {
  const errors: ValidationErrors = {};

  // Name validation (only for signup)
  if (data.name !== undefined) {
    if (!data.name.trim()) {
      errors.name = "請輸入名字";
    }
  }

  // Email validation
  if (!data.email.trim()) {
    errors.email = "請輸入電子郵件";
  } else {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(data.email)) {
      errors.email = "電子郵件格式不正確";
    }
  }

  // Password validation
  if (!data.password) {
    errors.password = "請輸入密碼";
  } else {
    if (data.password.length < 8) {
      errors.password = "密碼至少要 8 個字元";
    } else if (!isDevelopment) {
      // Additional password rules only for staging and production
      // if (!/[a-z]/.test(data.password)) {
      //   errors.password = "At least one lowercase letter";
      // } else if (!/[A-Z]/.test(data.password)) {
      //   errors.password = "At least one uppercase letter";
      // } else if (!/\d/.test(data.password)) {
      //   errors.password = "At least one number";
      // }
    }
  }

  return errors;
}; 