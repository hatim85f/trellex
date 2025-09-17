const express = require("express");
const router = express.Router();
const Task = require("../../models/Task");
const User = require("../../models/User");
const Comment = require("../../models/Comment");
const auth = require("../../middleware/auth");
const sendNotification = require("../../helpers/sendNotification");
const SubTask = require("../../models/SubTask");
const { default: mongoose } = require("mongoose");

// @route   GET /api/tasks/:taskId
// @desc    Get a single task by ID
// @access  Private (add auth if needed)
router.get("/:taskId", auth, async (req, res) => {
  const { taskId } = req.params;
  try {
    const task = await Task.findById(taskId)
      .populate("participants")
      .populate("comments")
      .populate("subtasks");
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.status(200).json({ task });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// @route   GET api/tasks/get-tasks/:userId
// @desc    Aggregate tasks for a user with creator, participants, rich comments, and daysLeft
// @access  Private
router.get("/get-tasks/:userId", auth, async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.userId);

    // Tasks created by the user or where the user is a participant
    const matchStage = {
      $or: [{ createdBy: userId }, { participants: userId }],
    };

    const tasks = await Task.aggregate([
      { $match: matchStage },

      // Participants -> details
      {
        $lookup: {
          from: "users",
          localField: "participants",
          foreignField: "_id",
          as: "participantDetails",
        },
      },

      // Creator -> details (array; we normalize later)
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "creatorInfo",
        },
      },

      // Comments with embedded user info (single lookup pipeline)
      {
        $lookup: {
          from: "comments",
          let: { commentIds: "$comments" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$commentIds"] } } },
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userObj",
              },
            },
            { $addFields: { userObj: { $arrayElemAt: ["$userObj", 0] } } },
            {
              $project: {
                _id: 1,
                title: 1,
                content: 1,
                backgroundColor: 1,
                createdAt: 1,
                userFullName: "$userObj.fullName",
                userProfilePicture: "$userObj.profilePicture",
                userPosition: "$userObj.position",
                userEmail: "$userObj.email",
              },
            },
          ],
          as: "commentDetails",
        },
      },

      // Normalize shapes + compute daysLeft
      {
        $addFields: {
          // daysLeft: negative if overdue, 0 if due today, positive if in future
          daysLeft: {
            $dateDiff: {
              startDate: "$$NOW",
              endDate: "$endDate",
              unit: "day",
            },
          },

          createdBy: {
            fullName: { $arrayElemAt: ["$creatorInfo.fullName", 0] },
            profilePicture: {
              $arrayElemAt: ["$creatorInfo.profilePicture", 0],
            },
            position: { $arrayElemAt: ["$creatorInfo.position", 0] },
            _id: { $arrayElemAt: ["$creatorInfo._id", 0] },
            pushTokens: { $arrayElemAt: ["$creatorInfo.pushTokens", 0] },
          },

          participantDetails: {
            $map: {
              input: "$participantDetails",
              as: "p",
              in: {
                _id: "$$p._id",
                fullName: "$$p.fullName",
                profilePicture: "$$p.profilePicture",
                position: "$$p.position",
                pushTokens: "$$p.pushTokens",
              },
            },
          },

          comments: "$commentDetails",
        },
      },

      // Final projection
      {
        $project: {
          _id: 1,
          title: 1,
          description: 1,
          startDate: 1,
          endDate: 1,
          status: 1,
          priority: 1,
          progress: 1,
          daysLeft: 1,
          createdBy: 1,
          participantDetails: 1,
          comments: 1,
          tags: 1,
          attachments: 1,
          isDeleted: 1,
          summary: 1,
          feedback: 1,
          subtasks: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    return res.status(200).json({ tasks });
  } catch (error) {
    console.error(error);
    return res.status(500).send({
      error: "ERROR!",
      message:
        "Something went wrong, we couldn't retrieve your data. Please try again later",
    });
  }
});

// @route   POST api/tasks
// @desc    Create a new task
// @access  Public or Private (add auth if needed)
router.post("/", auth, async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      status,
      progress,
      startDate,
      endDate,
      userId,
      participants,
      comments,
      attachments,
      tags,
      summary,
      feedback,
      subtasks,
    } = req.body;

    const newTask = new Task({
      title,
      description,
      priority,
      status,
      progress,
      startDate,
      endDate,
      createdBy: userId,
      participants,
      comments,
      attachments,
      tags,
      summary,
      feedback,
      subtasks,
    });

    await User.updateOne(
      { _id: userId },
      { $addToSet: { tasks: newTask._id } }
    );

    const savedTask = await newTask.save();
    res
      .status(201)
      .json({ message: "Task created successfully", task: savedTask });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({
      error: "ERROR!",
      message: "Something went wrong, please try again later.",
    });
  }
});

// @route  PUT api/tasks/:taskId
// @desc   Update a task by ID, by adding participants
// @access Private (add auth if needed)
router.put("/:taskId", auth, async (req, res) => {
  const { userId, participants } = req.body;
  const { taskId } = req.params;

  try {
    const user = await User.findOne({ _id: userId });
    const task = await Task.findOne({ _id: taskId });
    await Task.updateOne(
      { _id: taskId },
      {
        $addToSet: { participants: { $each: participants } },
      }
    );

    // Update each participant's tasks array
    for (let participant of participants) {
      await User.updateOne(
        { _id: participant },
        { $addToSet: { tasks: taskId } }
      );
    }

    // send notification to new participants (if needed)

    sendNotification({
      title: `${user.fullName} assigned you a new task`,
      subject: "You have been added to a new task",
      message: `You have been assigned to the task: ${task.title}`,
      pushTokens: [], // Fetch and provide actual push tokens of participants
      userIds: participants,
    });

    return res.status(200).json({
      message:
        "Task updated successfully and a notification sent to participants",
      task,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({
      error: "ERROR!",
      message: "Something went wrong, please try again later.",
    });
  }
});

// @route  PUT api/tasks/add-subtask/:taskId
// @desc   Update a task by ID, by adding subtasks
router.put("/add-subtask/:taskId", auth, async (req, res) => {
  const { taskId } = req.params;
  const { userId, title, assignedTo } = req.body;

  try {
    const task = await Task.findOne({ _id: taskId });

    const newSubTask = await new SubTask({
      mainTask: taskId,
      assignedTo: assignedTo ? assignedTo : userId,
      createdBy: userId,
      title,
      status: "in-progress",
      startDate: Date.now(),
      endDate: task.endDate,
    });

    const savedSubTask = await newSubTask.save();

    const taskedPersonId = assignedTo ? assignedTo : userId;

    const user = await User.findOne({ _id: taskedPersonId });

    const message =
      userId === taskedPersonId
        ? "Your subtask created successfully"
        : `A new subtask assigned to you`;
    const messageTitle =
      userId === taskedPersonId ? "Subtask Created" : "New Subtask Assigned";
    const messageSubTitle =
      userId === taskedPersonId
        ? "You created a new subtask"
        : "You have been assigned a new subtask";
    const userTokens = user.pushTokens || [];

    await sendNotification({
      title: messageTitle,
      subject: messageSubTitle,
      message: `${message} : ${title}`,
      pushTokens: userTokens,
      userIds: [taskedPersonId],
    });

    await Task.updateOne(
      { _id: taskId },
      { $addToSet: { subtasks: savedSubTask._id } }
    );

    return res.status(200).send({
      message: "Subtask added successfully",
      subtask: savedSubTask,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({
      error: "ERROR!",
      message: "Something went wrong please try again later",
    });
  }
});

// @route   PUT api/tasks/update-subtask-progress/:subtaskId
// @desc    Update the progress of a subtask
// @access  Public or Private (add auth if needed)
router.put("/update-subtask-progress/:subtaskId", auth, async (req, res) => {
  const { subtaskId } = req.params;
  const { progress } = req.body;

  try {
    const subTask = await SubTask.findOne({ _id: subtaskId });

    const taskProgress = subTask.progress;

    const newProgress = taskProgress + progress;

    const updatedSubtask = await SubTask.updateOne(
      { _id: subtaskId },
      { $set: { progress: newProgress } },
      { new: true }
    );

    const mainTaskProgress = await Task.aggregate([
      { $match: { _id: subTask.mainTask } },
      {
        $lookup: {
          from: "subtasks",
          localField: "_id",
          foreignField: "mainTask",
          as: "subtaskDetails",
        },
      },
      {
        $project: {
          avgProgress: { $avg: "$subtaskDetails.progress" },
        },
      },
    ]);

    // return mainTaskProgress toFixed(2);
    const avgProgress = mainTaskProgress[0]?.avgProgress || 0;

    await Task.updateOne(
      { _id: subTask.mainTask },
      { $set: { progress: avgProgress.toFixed(2) } }
    );

    return res
      .status(200)
      .json({ message: "Subtask progress updated", subtask: updatedSubtask });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({
      error: "ERROR!",
      message: "Something went wrong, please try again later.",
    });
  }
});

router.put("/comment-main-task/:taskId", auth, async (req, res) => {
  const { taskId } = req.params;
  const { userId, title, content } = req.body;

  try {
    const user = await User.findOne({ _id: userId });

    // Prevent duplicate comment from same user with same content on the same task
    const existingComment = await Comment.findOne({
      user: userId,
      forTask: taskId,
      content: content,
    });
    if (existingComment) {
      return res.status(400).send({
        message: "Duplicate comment: You have already posted this comment.",
      });
    }

    const newComment = new Comment({
      user: userId,
      title,
      content,
      forTask: taskId,
      backgroundColor: user.commentColor,
    });

    await newComment.save();

    const task = await Task.findOne({ _id: taskId });
    let newStatus = task.status;
    if (task.status === "pending") {
      newStatus = "in-progress";
    }
    await Task.updateOne(
      { _id: taskId },
      {
        $addToSet: { comments: newComment._id },
        $set: { status: newStatus },
      }
    );

    const participantsToken = await User.find({
      _id: { $in: task.participants },
    }).distinct("pushTokens");

    console.log(task.participants);

    await sendNotification({
      title: `New comment on task: ${task.title}`,
      subject: "A new comment has been added",
      message: `${title} - ${content}`,
      pushTokens: participantsToken || [],
      userIds: task.participants,
    });

    return res.status(200).send({
      message: "Comment added successfully",
      comment: newComment,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({
      error: "ERROR!",
      message: "Something went wrong, please try again later.",
    });
  }
});

// @route   PUT /api/add-subtask-feedback/:subtaskId
// @desc    Add a feedback string to a subtask's feedback array
// @access  Public or Private (add auth if needed)
router.put("/add-subtask-feedback/:subtaskId", async (req, res) => {
  const { subtaskId } = req.params;
  const { userId, feedback } = req.body;

  try {
    const subTask = await SubTask.findOne({ _id: subtaskId });

    // Prevent duplicate feedback from same user with same text in subtask
    const subtaskFeedbackExists = subTask.feedback.some(
      (fb) => fb.createdBy.toString() === userId && fb.feedback === feedback
    );
    let updatedSubtask = subTask;
    if (!subtaskFeedbackExists) {
      updatedSubtask = await SubTask.findByIdAndUpdate(
        subtaskId,
        {
          $addToSet: {
            feedback: {
              feedback,
              createdBy: userId,
            },
          },
        },
        { new: true }
      );
    }

    const mainTask = await Task.findOne({ _id: subTask.mainTask });

    // Notify main task participants about new feedback
    const participantTokens = await User.find({
      _id: { $in: mainTask.participants },
    }).distinct("pushTokens");

    // Prevent duplicate feedback from same user with same text
    const feedbackExists = mainTask.feedback.some(
      (fb) => fb.createdBy.toString() === userId && fb.feedback === feedback
    );
    if (!feedbackExists) {
      await Task.updateOne(
        { _id: mainTask._id },
        {
          $addToSet: {
            feedback: {
              feedback,
              createdBy: userId,
            },
          },
        },
        { new: true }
      );
    }

    await sendNotification({
      title: `New feedback on subtask of: ${mainTask.title}`,
      subject: "A new feedback has been added",
      message: `${feedback}`,
      pushTokens: participantTokens,
      userIds: mainTask.participants,
    });

    return res
      .status(200)
      .json({ message: "Feedback added to subtask", subtask: updatedSubtask });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// @route   PUT /api/tasks/:taskId/summarize-feedback
// @desc    Summarize all feedbacks for a task, save summary and conclusion, notify all relevant users, and mark as completed
// @access  Private (add auth if needed)
router.put("/summarize-feedback/:taskId", auth, async (req, res) => {
  const { taskId } = req.params;
  const { conclusion } = req.body;
  try {
    const task = await Task.findOne({ _id: taskId });

    // Summarize feedbacks (collect all feedback strings)
    const feedbackSummary = Array.isArray(task.feedback)
      ? task.feedback.map((fb) => fb.feedback)
      : [];

    // Update task: set summary, conclusion, and status to completed
    task.summary = feedbackSummary;
    task.conclusion = conclusion;
    task.status = "completed";
    await task.save();

    // Collect all relevant users: participants, managers, supervisors
    const participantIds = Array.isArray(task.participants)
      ? task.participants.map((id) => id.toString())
      : [];
    // Find managers and supervisors of participants
    const users = await User.find({ _id: { $in: participantIds } });
    let managerIds = [];
    let supervisorIds = [];
    users.forEach((u) => {
      if (Array.isArray(u.managerOfTeams)) managerIds.push(...u.managerOfTeams);
      if (Array.isArray(u.supervisorOfTeams))
        supervisorIds.push(...u.supervisorOfTeams);
    });
    // Get all users who are managers or supervisors of these teams
    const managers = managerIds.length
      ? await User.find({ managerOfTeams: { $in: managerIds } })
      : [];
    const supervisors = supervisorIds.length
      ? await User.find({ supervisorOfTeams: { $in: supervisorIds } })
      : [];
    const notifyUserIds = [
      ...participantIds,
      ...managers.map((m) => m._id.toString()),
      ...supervisors.map((s) => s._id.toString()),
    ];
    // Get push tokens for all
    const pushTokens = await User.find({
      _id: { $in: notifyUserIds },
    }).distinct("pushTokens");

    // Send notification
    await sendNotification({
      title: `Task summary created: ${task.title}`,
      subject: "Task has been summarized and completed",
      message: `A summary and conclusion have been added to the task.`,
      pushTokens,
      userIds: notifyUserIds,
    });

    return res.status(200).json({
      message: "Task summarized and completed",
      summary: feedbackSummary,
      conclusion,
    });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// @route   DELETE /api/tasks/:taskId
// @desc    Delete a task by its ID
// @access  Private (add auth if needed)
router.delete("/:taskId", auth, async (req, res) => {
  const { taskId } = req.params;
  try {
    const deletedTask = await Task.findByIdAndDelete(taskId);
    if (!deletedTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// @route   DELETE /api/tasks/:taskId/comments/:commentId
// @desc    Delete a comment by its ID and remove it from the task's comments array
// @access  Private (add auth if needed)
router.delete("/:taskId/comments/:commentId", auth, async (req, res) => {
  const { taskId, commentId } = req.params;
  try {
    // Remove the comment document
    const deletedComment = await Comment.findByIdAndDelete(commentId);
    if (!deletedComment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    // Remove the comment reference from the task
    await Task.findByIdAndUpdate(taskId, { $pull: { comments: commentId } });
    return res
      .status(200)
      .json({ message: "Comment deleted and removed from task" });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// --- Task Comments CRUD ---

// Update a comment
// @route   PUT /api/comments/:commentId
// @desc    Update a comment by its ID
// @access  Private
router.put("/comments/:commentId", auth, async (req, res) => {
  const { commentId } = req.params;
  const updateFields = req.body;
  try {
    const updatedComment = await Comment.updateOne(
      { _id: commentId },
      { $set: updateFields },
      { new: true }
    );

    return res
      .status(200)
      .json({ message: "Comment updated", comment: updatedComment });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// Delete a comment from a task (already implemented above)

// Unassign participants from a task
// @route   PUT /api/tasks/:taskId/unassign-participants
// @desc    Remove participants from a task's participants array
// @access  Private
router.put("/:taskId/unassign-participants", auth, async (req, res) => {
  const { taskId } = req.params;
  const { participantIds } = req.body; // array of user IDs
  try {
    const updatedTask = await Task.updateOne(
      { _id: taskId },
      { $pull: { participants: { $in: participantIds } } },
      { new: true }
    );

    return res
      .status(200)
      .json({ message: "Participants unassigned", task: updatedTask });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});
// --- SubTask CRUD ---

// Update SubTask
// @route   PUT /api/subtasks/:subtaskId
// @desc    Update a subtask by its ID
// @access  Private
router.put("/subtasks/:subtaskId", auth, async (req, res) => {
  const { subtaskId } = req.params;
  const updateFields = req.body;
  try {
    const updatedSubtask = await SubTask.findByIdAndUpdate(
      subtaskId,
      updateFields,
      { new: true }
    );

    return res
      .status(200)
      .json({ message: "Subtask updated", subtask: updatedSubtask });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// Delete SubTask
// @route   DELETE /api/tasks/:taskId/subtasks/:subtaskId
// @desc    Delete a subtask and remove from task
// @access  Private
router.delete("/:taskId/subtasks/:subtaskId", auth, async (req, res) => {
  const { taskId, subtaskId } = req.params;
  try {
    const deletedSubtask = await SubTask.findByIdAndDelete(subtaskId);
    if (!deletedSubtask) {
      return res.status(404).json({ message: "Subtask not found" });
    }
    await Task.findByIdAndUpdate(taskId, { $pull: { subtasks: subtaskId } });
    return res.status(200).json({ message: "Subtask deleted" });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// @route   PUT /api/tasks/:taskId
// @desc    Update task details by ID
// @access  Private (add auth if needed)
router.put("/:taskId", auth, async (req, res) => {
  const { taskId } = req.params;
  const updateFields = req.body;
  try {
    const updatedTask = await Task.findByIdAndUpdate(taskId, updateFields, {
      new: true,
    });
    if (!updatedTask) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res
      .status(200)
      .json({ message: "Task updated successfully", task: updatedTask });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

module.exports = router;
