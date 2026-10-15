const { QueryTypes } = require('sequelize');
const sequelize = require('../../database/config/database');

function resourceIdFrom(req, res) {
  const resourceId = req.body && req.body.resourceId;
  if (
    typeof resourceId !== 'string'
    || resourceId.length < 1
    || resourceId.length > 2048
    || !/^(sh|ft):/.test(resourceId)
  ) {
    res.status(400).json({ error: 'A valid Study Hub resource ID is required.' });
    return null;
  }
  return resourceId;
}

async function getStats(req, res) {
  try {
    const rows = await sequelize.query(
      `WITH rating_stats AS (
         SELECT resource_id,
                COUNT(*) FILTER (WHERE vote = 1)::INTEGER AS "upVotes",
                COUNT(*) FILTER (WHERE vote = -1)::INTEGER AS "downVotes",
                COUNT(*)::INTEGER AS "totalVotes"
         FROM public.study_hub_resource_ratings
         GROUP BY resource_id
       ),
       share_stats AS (
         SELECT resource_id, share_count::INTEGER AS "shareCount"
         FROM public.study_hub_resource_shares
       )
       SELECT COALESCE(rating_stats.resource_id, share_stats.resource_id) AS "resourceId",
              COALESCE(rating_stats."upVotes", 0)::INTEGER AS "upVotes",
              COALESCE(rating_stats."downVotes", 0)::INTEGER AS "downVotes",
              COALESCE(rating_stats."totalVotes", 0)::INTEGER AS "totalVotes",
              COALESCE(share_stats."shareCount", 0)::INTEGER AS "shareCount"
       FROM rating_stats
       FULL OUTER JOIN share_stats USING (resource_id)`,
      { type: QueryTypes.SELECT },
    );
    return res.json({ resources: rows });
  } catch (error) {
    console.error('Resource rating summary unavailable:', error);
    return res.status(500).json({ error: 'Resource ratings could not be loaded.' });
  }
}

async function getMyEngagement(req, res) {
  try {
    const [ratings, bookmarks] = await Promise.all([
      sequelize.query(
        `SELECT resource_id AS "resourceId", vote
         FROM public.study_hub_resource_ratings
         WHERE user_id = :userId`,
        { replacements: { userId: req.user.id }, type: QueryTypes.SELECT },
      ),
      sequelize.query(
        `SELECT resource_id AS "resourceId"
         FROM public.study_hub_resource_bookmarks
         WHERE user_id = :userId`,
        { replacements: { userId: req.user.id }, type: QueryTypes.SELECT },
      ),
    ]);
    return res.json({ ratings, bookmarks: bookmarks.map((row) => row.resourceId) });
  } catch (error) {
    console.error('Saved resource preferences unavailable:', error);
    return res.status(500).json({ error: 'Your saved resource preferences could not be loaded.' });
  }
}

async function saveVote(req, res) {
  const resourceId = resourceIdFrom(req, res);
  if (resourceId === null) return;
  const vote = req.body.vote;
  if (vote !== 1 && vote !== -1) {
    return res.status(400).json({ error: 'Choose a thumbs-up or thumbs-down rating.' });
  }

  try {
    await sequelize.query(
      `INSERT INTO public.study_hub_resource_ratings (resource_id, user_id, vote)
       VALUES (:resourceId, :userId, :vote)
       ON CONFLICT (resource_id, user_id)
       DO UPDATE SET vote = EXCLUDED.vote, updated_at = CURRENT_TIMESTAMP`,
      { replacements: { resourceId, userId: req.user.id, vote }, type: QueryTypes.INSERT },
    );
    return res.json({ resourceId, vote });
  } catch (error) {
    console.error('Resource rating could not be saved:', error);
    return res.status(500).json({ error: 'Your rating could not be saved.' });
  }
}

async function removeVote(req, res) {
  const resourceId = resourceIdFrom(req, res);
  if (resourceId === null) return;
  try {
    await sequelize.query(
      `DELETE FROM public.study_hub_resource_ratings
       WHERE resource_id = :resourceId AND user_id = :userId`,
      { replacements: { resourceId, userId: req.user.id }, type: QueryTypes.DELETE },
    );
    return res.status(204).end();
  } catch (error) {
    console.error('Resource rating could not be removed:', error);
    return res.status(500).json({ error: 'Your rating could not be removed.' });
  }
}

async function saveBookmark(req, res) {
  const resourceId = resourceIdFrom(req, res);
  if (resourceId === null) return;
  try {
    await sequelize.query(
      `INSERT INTO public.study_hub_resource_bookmarks (resource_id, user_id)
       VALUES (:resourceId, :userId)
       ON CONFLICT (resource_id, user_id) DO NOTHING`,
      { replacements: { resourceId, userId: req.user.id }, type: QueryTypes.INSERT },
    );
    return res.status(204).end();
  } catch (error) {
    console.error('Resource bookmark could not be saved:', error);
    return res.status(500).json({ error: 'This document could not be bookmarked.' });
  }
}

async function removeBookmark(req, res) {
  const resourceId = resourceIdFrom(req, res);
  if (resourceId === null) return;
  try {
    await sequelize.query(
      `DELETE FROM public.study_hub_resource_bookmarks
       WHERE resource_id = :resourceId AND user_id = :userId`,
      { replacements: { resourceId, userId: req.user.id }, type: QueryTypes.DELETE },
    );
    return res.status(204).end();
  } catch (error) {
    console.error('Resource bookmark could not be removed:', error);
    return res.status(500).json({ error: 'This document could not be removed from bookmarks.' });
  }
}

async function saveShare(req, res) {
  const resourceId = resourceIdFrom(req, res);
  if (resourceId === null) return;
  try {
    await sequelize.query(
      `INSERT INTO public.study_hub_resource_shares (resource_id)
       VALUES (:resourceId)
       ON CONFLICT (resource_id)
       DO UPDATE SET share_count = public.study_hub_resource_shares.share_count + 1,
                     updated_at = CURRENT_TIMESTAMP`,
      { replacements: { resourceId }, type: QueryTypes.INSERT },
    );
    return res.status(204).end();
  } catch (error) {
    console.error('Resource share could not be recorded:', error);
    return res.status(500).json({ error: 'This resource share could not be recorded.' });
  }
}

module.exports = { getStats, getMyEngagement, saveVote, removeVote, saveBookmark, removeBookmark, saveShare };
