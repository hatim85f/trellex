const express = require("express");
const router = express.Router();
const Notification = require("../../models/Notification");
const { sendTemplateEmail } = require("../../lib/brevo");

const moment = require("moment");
const sendNotification = require("../../helpers/sendNotification");
const User = require("../../models/User");

router.get("/", async (req, res) => {
  res.status(200).send("Notifications route is working");
});

router.post("/notifications", async (req, res) => {
  const { userIds, from, title, subject, message } = req.body;

  try {
    const users = await User.find({ _id: "68c48acfd6066a3739538cf8" });

    let pushTokens = [];
    for (let user of users) {
      if (user.pushTokens) {
        pushTokens.push(...user.pushTokens);
      }
    }

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

router.put("/:notificationId", async (req, res) => {
  const { notificationId } = req.params;

  try {
    await Notification.updateOne(
      {
        _id: notificationId,
      },
      {
        $set: { isRead: true },
      }
    );

    return res
      .status(200)
      .json({ message: "Notification marked as read successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "ERROR!", message: "Something went wrong." });
  }
});

module.exports = router;
