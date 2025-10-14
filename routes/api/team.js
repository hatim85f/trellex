const express = require("express");
const router = express.Router();

const isAdmin = require("../../middleware/isAdmin");
const Team = require("../../models/Team");
const User = require("../../models/User");
const { default: mongoose } = require("mongoose");
const auth = require("../../middleware/auth");
const TeamJoinRequest = require("../../models/TeamJoinRequest");
const sendNotification = require("../../helpers/sendNotification");

router.get("/:userId", auth, async (req, res) => {
  // if user.position is Employee his teams will be in array memberOfTeams
  // if user.position is Supervisor his teams will be in array supervisorOfTeams
  // if user.position is Manager his teams will be in array managerOfTeams

  const { userId } = req.params;

  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res
        .status(404)
        .send({ error: "ERROR!", message: "User not found" });
    }

    let teams = [];
    if (user.position === "Employee") {
      teams = await Team.find({ _id: { $in: user.memberOfTeams } });
    } else if (user.position === "Supervisor") {
      teams = await Team.find({ _id: { $in: user.supervisorOfTeams } });
    } else if (user.position === "Manager") {
      teams = await Team.find({ _id: { $in: user.managerOfTeams } });
    }

    let joiningRequests = [];
    if (user.position === "Supervisor") {
      joiningRequests = await TeamJoinRequest.find({
        teamSupervisor: userId,
        isApproved: false,
      });
    } else if (user.position === "Employee") {
      joiningRequests = await TeamJoinRequest.find({
        user: userId,
        isApproved: false,
      });
    }

    return res.status(200).send({ teams, joiningRequests });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({
      error: "ERROR!",
      message: "Something went wrong, please try again later.",
    });
  }
});

// @route POST api/team
// @desc Send a request to join a team
// @access Public
router.post("/join", auth, async (req, res) => {
  const { teamCode, userId } = req.body;

  try {
    // check if team exists
    const team = await Team.findOne({ teamCode });
    if (!team) {
      return res.status(404).send({
        error: "ERROR!",
        message: "Team not found.",
      });
    }

    const requestExists = await TeamJoinRequest.findOne({
      user: userId,
      teamCode,
    });

    if (requestExists) {
      return res.status(400).send({
        error: "ERROR!",
        message:
          "You have already sent a join request to this team, please wait for their admin confirmation.",
      });
    }

    const isMember = team.members.includes(new mongoose.Types.ObjectId(userId));
    if (isMember) {
      return res.status(400).send({
        error: "ERROR!",
        message: "You are already a member of this team.",
      });
    }

    const user = await User.findOne({ _id: userId });
    const teamSupervisor = await User.findOne({ _id: team.supervisedBy });

    // return res.status(200).send({ team: team.supervisedBy });

    // create a new join request
    const newJoinRequest = new TeamJoinRequest({
      user: userId,
      teamCode,
      profilePicture: user.profilePicture,
      fullName: user.fullName,
      teamName: team.teamName,
      teamSupervisor: team.supervisedBy,
    });

    await newJoinRequest.save();

    const userFullName = user.fullName;

    await sendNotification({
      title: "New Team Join Request",
      subject: `Join request from ${userFullName}`,
      message: `User ${userFullName} has requested to join your team.`,
      pushTokens: [teamSupervisor.pushTokens], // Add the team's admin push tokens here
      userIds: [userId], // Save notification for the user who sent the request
    });

    return res.status(200).send({
      message:
        "Join request sent successfully, team admin will review it shortly.",
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({
      error: "ERROR!",
      message: error.message,
    });
  }
});

// @route   POST api/team
// @desc    Create a new team
// @access  Private (Admin only)
router.post("/", auth, async (req, res) => {
  const { teamName, userId, teamLogo } = req.body;

  try {
    // check if team name is already taken

    const teams = await Team.find({});
    const teamsNames = teams.map((t) => t.teamName.trim().toLowerCase());

    // map all names and check if there is a match

    if (teamsNames.includes(teamName.trim().toLowerCase())) {
      return res
        .status(500)
        .send({ error: "ERROR!", message: "Team name is already taken" });
    }

    const teamCode = Math.random().toString(36).substring(2, 7).toUpperCase();

    const newTeam = new Team({
      teamName: teamName,
      supervisedBy: userId,
      teamCode: teamCode,
      teamLogo: teamLogo,
    });

    const savedTeam = await newTeam.save();

    await User.updateOne(
      { _id: userId },
      { $addToSet: { supervisorOfTeams: savedTeam._id } }
    );

    return res.status(200).json({
      message: `Team ${teamName} created successfully`,
      teamId: savedTeam._id,
      team: savedTeam,
    });
  } catch (error) {
    console.error(error.message);
    return res.status(500).send({
      error: "ERROR!",
      message: error.message || "Something went wrong, please try again later.",
    });
  }
});

// @route   PUT api/team/approve-join
// @desc    Approve a join request, add user to team members, and delete join request
// @access  Private (Admin only)
router.put("/approve-join", auth, async (req, res) => {
  const { joinRequestId } = req.body;
  if (!joinRequestId) {
    return res.status(400).json({ message: "joinRequestId is required" });
  }
  try {
    // Find the join request
    const joinRequest = await TeamJoinRequest.findOne({ _id: joinRequestId });
    if (!joinRequest) {
      return res.status(404).json({ message: "Join request not found" });
    }
    // Find the team
    const team = await Team.findOne({ teamCode: joinRequest.teamCode });
    if (!team) {
      return res.status(404).json({ message: "Team not found" });
    }
    // Add user to team members (no duplicates)
    await Team.updateOne(
      { _id: team._id },
      { $addToSet: { members: joinRequest.user } }
    );

    await User.updateOne(
      { _id: joinRequest.user },
      { $addToSet: { memberOfTeams: team._id } }
    );
    // Notify the user that their request was approved
    await sendNotification({
      title: "Team Join Request Approved",
      subject: "",
      message: `You have been added to the team ${team.teamName}.`,
      pushTokens: [], // Add logic to get user's push tokens if needed
      userIds: [joinRequest.user.toString()],
    });
    // Delete the join request
    await TeamJoinRequest.deleteOne({ _id: joinRequestId });
    return res.status(200).json({
      message: "User added to team members and notified",
    });
  } catch (error) {
    console.error(error.message);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// @route   PUT api/team/:teamId
// @desc    Edit team details
// @access  Private (Admin only)
router.put("/:teamId", auth, async (req, res) => {
  const { teamId } = req.params;
  const { teamName, supervisedBy, teamCode } = req.body;
  try {
    const updateFields = {};
    if (teamName) updateFields.teamName = teamName;
    if (supervisedBy) updateFields.supervisedBy = supervisedBy;
    if (teamCode) updateFields.teamCode = teamCode;
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $set: updateFields },
      { new: true }
    );
    if (!updatedTeam) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json({ message: "Team updated successfully", team: updatedTeam });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// @route   PUT api/team/remove-member/:userId
// @desc    Remove a user from team members array
// @access  Private (Admin only)
router.put("/remove-member/:userId", auth, async (req, res) => {
  const { userId } = req.params;
  const { teamId } = req.body;
  if (!teamId) {
    return res.status(400).json({ message: "teamId is required in body" });
  }
  try {
    const updatedTeam = await Team.updateOne(
      { _id: teamId },
      { $pull: { members: userId } },
      { new: true }
    );
    if (!updatedTeam) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json({ message: "User removed from team members", team: updatedTeam });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

// @route   PUT api/team/leave/:teamId
// @desc    Allow a user to remove themselves from a team
// @access  Private
router.put("/leave/:teamId", auth, async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user.id;
  try {
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $pull: { members: userId } },
      { new: true }
    );
    if (!updatedTeam) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json({ message: "You have left the team", team: updatedTeam });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});
// @route   PUT api/team/bulk-remove-members/:teamId
// @desc    Remove multiple users from team members array
// @access  Private (Admin only)
router.put("/bulk-remove-members/:teamId", auth, async (req, res) => {
  const { teamId } = req.params;
  const { userIds } = req.body;
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    return res
      .status(400)
      .json({ message: "userIds array is required in body" });
  }
  try {
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $pull: { members: { $in: userIds } } },
      { new: true }
    );
    if (!updatedTeam) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json({ message: "Users removed from team members", team: updatedTeam });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});
// @route   DELETE api/team/reject-join/:joinRequestId
// @desc    Reject a join request and notify the user
// @access  Private (Admin only)
router.delete("/reject-join/:joinRequestId", auth, async (req, res) => {
  const { joinRequestId } = req.params;
  try {
    const joinRequest = await TeamJoinRequest.findById(joinRequestId);
    if (!joinRequest) {
      return res.status(404).json({ message: "Join request not found" });
    }
    // Optionally notify the user
    await sendNotification({
      title: "Team Join Request Rejected",
      subTitle: "",
      message: "Your request to join the team was rejected.",
      pushTokens: [], // Add logic to get user's push tokens if needed
      userIds: [joinRequest.user.toString()],
    });
    await TeamJoinRequest.deleteOne({ _id: joinRequestId });
    res.json({ message: "Join request rejected and user notified" });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});
// @route   PUT api/team/transfer-ownership/:teamId
// @desc    Transfer team ownership to another user
// @access  Private (Admin only)
router.put("/transfer-ownership/:teamId", auth, async (req, res) => {
  const { teamId } = req.params;
  const { newSupervisorId } = req.body;
  if (!newSupervisorId) {
    return res.status(400).json({ message: "newSupervisorId is required" });
  }
  try {
    const updatedTeam = await Team.findByIdAndUpdate(
      teamId,
      { $set: { supervisedBy: newSupervisorId } },
      { new: true }
    );
    if (!updatedTeam) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json({ message: "Team ownership transferred", team: updatedTeam });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});
// @route   DELETE api/team/:teamId
// @desc    Delete a team by teamId
// @access  Private (Admin only)
router.delete("/:teamId", auth, async (req, res) => {
  const { teamId } = req.params;
  try {
    const deleted = await Team.findByIdAndDelete(teamId);
    if (!deleted) {
      return res.status(404).json({ message: "Team not found" });
    }
    res.json({ message: "Team deleted successfully", teamId });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({ message: "Something went wrong, please try again later." });
  }
});

module.exports = router;
