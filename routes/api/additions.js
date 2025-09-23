const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const Comment = require("../../models/Comment");
const auth = require("../../middleware/auth");
const Notification = require("../../models/Notification");
const { sendTemplateEmail } = require("../../lib/brevo");

router.put("/", auth, async (req, res) => {
  const { userIds, from, title, subject, message } = req.body;

  try {
    userIds.map((a) => {
      const newNotification = new Notification({
        to: a,
        from,
        title,
        subject,
        message,
      });
      newNotification.save();
    });

    return res.status(200).send({ message: "Notification saved successfully" });
  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
