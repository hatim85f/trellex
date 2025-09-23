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

router.post("/mail", async (req, res) => {
  const { email, name } = req.body;

  try {
    const code = Math.floor(100000 + Math.random() * 900000);

    await sendTemplateEmail({
      to: email,
      name: name,
      templateId: 1,
      paramse: {
        full_name: name,
        code,
        time: moment(new Date()).format("hh:mm A MMMM Do, YYYY"),
      },
    });

    return res.status(200).send({ message: "Email Sent Successfully" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
});

module.exports = router;
