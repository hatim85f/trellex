const Notification = require("../models/Notification");
const axios = require("axios");

/**
 * Send push notification using Expo and save to Notification collection
 * @param {Object} params
 * @param {string} params.title - Notification title
 * @param {string} params.subject - Notification subtitle
 * @param {string} params.message - Notification message
 * @param {string[]} params.pushTokens - Array of Expo push tokens
 * @param {string[]} [params.userIds] - Array of user IDs to save notification for (optional)
 */
async function sendNotification({
  from,
  title,
  subject, // fix: use subTitle consistently
  message,
  pushTokens,
  userIds = [],
}) {
  // if (!pushTokens || !Array.isArray(pushTokens) || pushTokens.length === 0) {
  //   throw new Error("No push tokens provided");
  // }

  // Prepare Expo messages
  const expoMessages = pushTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    subtitle: subject,
    body: message,
    data: { title, subject, message },
  }));

  // Send notifications via Expo
  const expoResponse = await axios.post(
    "https://exp.host/--/api/v2/push/send",
    expoMessages,
    { headers: { "Content-Type": "application/json" } }
  );
  const expoResult = expoResponse.data;

  // Save notification in DB for each user (if userIds provided)
  if (userIds && Array.isArray(userIds) && userIds.length > 0) {
    for (let userId of userIds) {
      const newNotification = new Notification({
        to: userId,
        from,
        title,
        subject,
        message,
      });
      await newNotification.save();
    }
  }

  return expoResult;
}

module.exports = sendNotification;
