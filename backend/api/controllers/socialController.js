const { Op } = require('sequelize');
const User = require('../../database/models/postgres/user');
const Message = require('../../database/models/postgres/message');
const Group = require('../../database/models/postgres/group');
const Event = require('../../database/models/postgres/event');
const Notification = require('../../database/models/postgres/notification');

// ----------------------
// Send a message
// ----------------------
exports.sendMessage = async (req, res) => {
  try {
    const { recipientId, content, groupId } = req.body;

    const message = await Message.create({
      senderId: req.user.id,
      recipientId: recipientId || null,
      groupId: groupId || null,
      content,
      timestamp: new Date()
    });

    res.status(201).json({ message: 'Message sent', data: message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Fetch messages for user
// ----------------------
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { senderId: req.user.id },
          { recipientId: req.user.id }
        ]
      },
      order: [['timestamp', 'DESC']]
    });

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Create a group / community
// ----------------------
exports.createGroup = async (req, res) => {
  try {
    const { name, description, members } = req.body;

    const group = await Group.create({
      name,
      description,
      creatorId: req.user.id
    });

    // Add members (optional)
    if (members && members.length > 0) {
      await group.addUsers(members); // Many-to-many relation
    }

    res.status(201).json({ message: 'Group created', group });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Fetch groups user belongs to
// ----------------------
exports.getUserGroups = async (req, res) => {
  try {
    const groups = await Group.findAll({
      include: [
        {
          model: User,
          where: { id: req.user.id }
        }
      ]
    });

    res.json({ groups });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Schedule an event
// ----------------------
exports.scheduleEvent = async (req, res) => {
  try {
    const { title, description, startTime, endTime, participants } = req.body;

    const event = await Event.create({
      title,
      description,
      startTime,
      endTime,
      creatorId: req.user.id
    });

    if (participants && participants.length > 0) {
      await event.addUsers(participants); // Many-to-many
    }

    res.status(201).json({ message: 'Event scheduled', event });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------
// Fetch notifications
// ----------------------
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};