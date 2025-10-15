const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const Comment = require("../../models/Comment");
const auth = require("../../middleware/auth");
const Notification = require("../../models/Notification");
const { sendTemplateEmail } = require("../../lib/brevo");
const sendNotification = require("../../helpers/sendNotification");

router.get("/", async (req, res) => {
  res.status(200).send("Additions route is working");
});

router.put("/notifications", async (req, res) => {
  const { userIds, from, title, subject, message } = req.body;

  return res.status(200).send({ userIds, from, title, subject, message });

  try {
    const userTokens = await User.find({ _id: { $in: userIds } }).select(
      "pushToken email firstName"
    );
    const pushTokens = userTokens.map((u) => u.pushToken).filter((t) => t);

    // Send push notifications
    if (pushTokens.length > 0) {
      await sendNotification({
        from,
        title,
        subject,
        pushTokens,
      });
    }

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
