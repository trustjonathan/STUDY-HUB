const express = require('express');
const router = express.Router();
const socialController = require('../api/controllers/socialController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateCreateGroup, validateMessage } = require('../api/validators/socialValidator');

// ----------------------
// Public Routes
// ----------------------

// Public forums or announcements
router.get('/forums', socialController.listPublicForums);
router.get('/forums/:forumId', socialController.getForumThreads);

// ----------------------
// Protected Routes (require authentication)
// ----------------------

// Chat messaging
router.post('/message', authMiddleware.verifyToken, validateMessage, socialController.sendMessage);
router.get('/messages/:chatId', authMiddleware.verifyToken, socialController.getChatMessages);

// Groups / Guilds
router.post('/groups', authMiddleware.verifyToken, validateCreateGroup, socialController.createGroup);
router.get('/groups', authMiddleware.verifyToken, socialController.listUserGroups);
router.get('/groups/:groupId', authMiddleware.verifyToken, socialController.getGroupDetails);
router.put('/groups/:groupId', authMiddleware.verifyToken, socialController.updateGroup);
router.delete('/groups/:groupId', authMiddleware.verifyToken, socialController.deleteGroup);

// Voice / Video rooms
router.post('/rooms', authMiddleware.verifyToken, socialController.createRoom);
router.get('/rooms', authMiddleware.verifyToken, socialController.listRooms);
router.get('/rooms/:roomId', authMiddleware.verifyToken, socialController.getRoomInfo);

// Event Scheduler
router.post('/events', authMiddleware.verifyToken, socialController.createEvent);
router.get('/events', authMiddleware.verifyToken, socialController.listEvents);
router.get('/events/:eventId', authMiddleware.verifyToken, socialController.getEvent);

// Activity feeds / notifications
router.get('/feed', authMiddleware.verifyToken, socialController.getActivityFeed);
router.get('/notifications', authMiddleware.verifyToken, socialController.getNotifications);
router.put('/notifications/:notificationId/read', authMiddleware.verifyToken, socialController.markNotificationRead);

// ----------------------
// Export Router
// ----------------------
module.exports = router;