const express = require("express");
const router = express.Router();
const Notification = require("../../models/Notification");

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
