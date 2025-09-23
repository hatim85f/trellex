const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const config = require("config");
const { check, validationResult } = require("express-validator");
const User = require("../../models/User");
const auth = require("../../middleware/auth");
const isAdmin = require("../../middleware/isAdmin");
const { sendTemplateEmail } = require("../../lib/brevo");
const passwordReset = require("../../models/PasswordReset");
const EmailConfirmation = require("../../models/EmailConfirmationCode");
const moment = require("moment");
const { sensitiveLimiter } = require("../../middleware/rateLimiter");

// @route   GET api/auth/check-username
// @desc    Check if username is unique
// @access  Public
router.get("/check-username", async (req, res) => {
  const { userName } = req.query;
  if (!userName) {
    return res.status(400).json({ message: "Username is required" });
  }
  try {
    const user = await User.findOne({ userName });
    if (user) {
      return res.json({ unique: false, message: "Username is already taken" });
    } else {
      return res.json({ unique: true, message: "Username is available" });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   GET api/auth/check-email
// @desc    Check if email is unique
// @access  Public
router.get("/check-email", async (req, res) => {
  const { email } = req.query;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  try {
    const user = await User.findOne({ email });
    if (user) {
      return res.json({ unique: false, message: "Email is already taken" });
    } else {
      return res.json({ unique: true, message: "Email is available" });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post(
  "/login",
  sensitiveLimiter,
  [
    check("userName", "Username is required").not().isEmpty(),
    check("password", "Password is required").exists(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userName, password } = req.body;

    if (!userName) {
      return res
        .status(500)
        .send({ error: "Error", message: "Username is required" });
    }

    if (!password) {
      return res
        .status(500)
        .send({ error: "Error", message: "Password is required" });
    }

    try {
      let user = await User.findOne({ userName });
      if (!user) {
        return res
          .status(400)
          .json({ errors: [{ message: "Invalid Username or Password" }] });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res
          .status(400)
          .json({ errors: [{ message: "Invalid Username or Password" }] });
      }

      const payload = {
        user: {
          id: user.id,
        },
      };

      const token = jwt.sign(payload, config.get("jwtSecret"));

      return res.status(200).json({ user, token });
    } catch (err) {
      console.error(err.message);
      res.status(500).send({ message: "Server error" });
    }
  }
);

// @route   POST api/auth/biometric-login
// @desc    Login user with biometric data
// @access  Public
router.post("/biometric-login", async (req, res) => {
  const { userName, biometricData } = req.body;
  if (!userName || !biometricData) {
    return res
      .status(400)
      .json({ message: "Username and biometric data are required" });
  }
  try {
    const user = await User.findOne({ userName });
    if (!user || !user.biometricData) {
      return res
        .status(400)
        .json({ message: "Biometric login not set up for this user" });
    }
    // For real biometric, use secure comparison. Here, simple string match for demo.
    if (user.biometricData !== biometricData) {
      return res.status(400).json({ message: "Invalid biometric data" });
    }
    const payload = { user: { id: user.id } };
    jwt.sign(payload, config.get("jwtSecret"), (err, token) => {
      if (err) throw err;
      res.json({ token });
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post(
  "/register",
  [
    check("userName", "Username is required").not().isEmpty(),
    check("email", "Please include a valid email").isEmail(),
    check("fullName", "Full name is required").not().isEmpty(),
    check(
      "password",
      "Please enter a password with 6 or more characters"
    ).isLength({ min: 6 }),
    check("title", "Title is required").not().isEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      userName,
      email,
      fullName,
      password,
      profilePicture,
      position,
      title,
      dob,
    } = req.body;

    try {
      let user = await User.findOne({ $or: [{ email }, { userName }] });
      if (user) {
        return res
          .status(400)
          .json({ errors: [{ message: "Username or email already exists" }] });
      }

      // create a random 6 digits id for the user

      const usersLength = await User.countDocuments();
      const userId = (100000 + usersLength + 1).toString();

      user = new User({
        userId,
        userName,
        email,
        fullName,
        password,
        profilePicture: profilePicture || "",
        position: position || "Employee",
        title,
        dob,
      });

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);

      await user.save();

      const payload = {
        user: {
          id: user.id,
        },
      };

      const token = jwt.sign(payload, config.get("jwtSecret"));
      return res
        .status(200)
        .json({ message: "User registered successfully", user, token });
    } catch (err) {
      console.error(err.message);
      res.status(500).send({ message: "Server error" });
    }
  }
);

// @route   PUT api/auth/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", auth, async (req, res) => {
  const updates = (({
    fullName,
    email,
    profilePicture,
    position,
    dob,
    title,
  }) => ({
    fullName,
    email,
    profilePicture,
    position,
    dob,
    title,
  }))(req.body);

  // Remove undefined fields
  Object.keys(updates).forEach(
    (key) => updates[key] === undefined && delete updates[key]
  );

  try {
    // Prevent email/username collision
    if (updates.email) {
      const emailExists = await User.findOne({
        email: updates.email,
        _id: { $ne: req.user.id },
      });
      if (emailExists) {
        return res.status(400).json({ message: "Email is already taken" });
      }
    }
    // Optionally, add similar check for userName if you allow username update

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "Profile updated successfully", user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   POST api/auth/request-reset
// @desc    Request password reset, generate and save code
// @access  Public
router.post("/request-reset", sensitiveLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate random 5-digit code
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    // Remove any previous reset codes for this user
    await passwordReset.deleteMany({ user: user._id });

    // Correct: use create instead of insertMany
    await passwordReset.create({
      user: user._id,
      code,
    });

    // Send email with the code
    await sendTemplateEmail({
      to: email,
      name: user.fullName,
      templateId: 1,
      params: {
        full_name: user.fullName,
        code: code,
        time: moment(new Date()).format("hh:mm A"),
      },
    });

    return res
      .status(200)
      .send({ message: "Reset code sent to registered email" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   POST api/auth/reset-password
// @desc    Reset user password after verifying code
// @access  Public
router.put("/reset-password", sensitiveLimiter, async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res
      .status(400)
      .json({ message: "Email, code, and new password are required" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetEntry = await passwordReset.findOne({ user: user._id, code });
    if (!resetEntry) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Check if code is expired (should be handled by TTL, but double check)
    const now = new Date();
    if (resetEntry.createdAt && now - resetEntry.createdAt > 5 * 60 * 1000) {
      await passwordReset.deleteOne({ _id: resetEntry._id });
      return res.status(400).json({ message: "Code expired" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // Delete the reset code after use
    await passwordReset.deleteOne({ _id: resetEntry._id });

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   POST api/auth/biometric
// @desc    Save user biometric login data
// @access  Private
router.post("/biometric", auth, async (req, res) => {
  const { biometricData, userId } = req.body;
  if (!biometricData) {
    return res.status(400).json({ message: "Biometric data is required" });
  }
  try {
    // Use findByIdAndUpdate for update
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { biometricData } },
      { new: true }
    ).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "Biometric data saved successfully", user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   DELETE api/auth/delete-account
// @desc    Delete user account upon request
// @access  Private
router.delete("/delete-account", auth, async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }
  try {
    const result = await User.deleteOne({ _id: userId });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   POST api/auth/send-email-confirmation
// @desc    Send and save email confirmation code, send email to user
// @access  Public
router.post("/send-email-confirmation", sensitiveLimiter, async (req, res) => {
  const { email, full_name } = req.body;
  if (!email || !full_name) {
    return res
      .status(400)
      .json({ message: "Email and full_name are required" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate random 5-digit code
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    // Remove any previous confirmation codes for this user
    await EmailConfirmation.deleteMany({ userId: user._id });

    // Save new code
    await EmailConfirmation.create({ userId: user._id, code });

    // Send email with the code
    await sendTemplateEmail({
      to: email,
      name: full_name,
      templateId: 2,
      params: {
        full_name: full_name,
        email_code: code,
      },
    });

    res.json({ message: "Confirmation code sent to email" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

// @route   POST api/auth/verify-email-code
// @desc    Verify email confirmation code and set emailConfirmed to true
// @access  Public
router.post("/verify-email-code", sensitiveLimiter, async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ message: "Email and code are required" });
  }
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const EmailConfirmation = require("../../models/EmailConfirmationCode");
    const confirmation = await EmailConfirmation.findOne({
      userId: user._id,
      code,
    });
    if (!confirmation) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }
    user.emailConfirmed = true;
    await user.save();
    await EmailConfirmation.deleteMany({ userId: user._id });
    res.json({ message: "Email confirmed successfully" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: "Server error" });
  }
});

module.exports = router;
