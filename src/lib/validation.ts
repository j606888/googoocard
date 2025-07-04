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
      errors.name = "Please enter a name";
    }
  }

  // Email validation
  if (!data.email.trim()) {
    errors.email = "Email is required";
  } else {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(data.email)) {
      errors.email = "Please enter a valid email address";
    }
  }

  // Password validation
  if (!data.password) {
    errors.password = "Password is required";
  } else {
    if (data.password.length < 8) {
      errors.password = "At least 8 characters long";
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