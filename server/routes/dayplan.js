const express = require('express');
const { prisma } = require('../prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(total) {
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function addMinutes(timeStr, minutes) {
  return minutesToTime(timeToMinutes(timeStr) + minutes);
}

function formatTime12h(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function enrichItems(items, dayStartTime) {
  const sorted = [...items].sort((a, b) => {
    const aTime = a.startAt ? timeToMinutes(a.startAt) : null;
    const bTime = b.startAt ? timeToMinutes(b.startAt) : null;
    if (aTime !== null && bTime !== null) return aTime - bTime;
    if (aTime !== null && bTime === null) return 0;
    if (aTime === null && bTime !== null) return 0;
    return a.sortOrder - b.sortOrder;
  });

  const pinned = sorted.filter((i) => i.startAt);
  const unpinned = sorted.filter((i) => !i.startAt);

  const result = [];
  let currentTime = timeToMinutes(dayStartTime);
  let pinnedIdx = 0;
  let unpinnedIdx = 0;

  while (pinnedIdx < pinned.length || unpinnedIdx < unpinned.length) {
    if (pinnedIdx < pinned.length) {
      const nextPinTime = timeToMinutes(pinned[pinnedIdx].startAt);

      while (unpinnedIdx < unpinned.length && currentTime + unpinned[unpinnedIdx].plannedMinutes <= nextPinTime) {
        const item = unpinned[unpinnedIdx];
        const mins = item.actualMinutes ?? item.plannedMinutes;
        result.push({ ...item, _scheduledTime: minutesToTime(currentTime) });
        currentTime += mins;
        unpinnedIdx++;
      }

      const pItem = pinned[pinnedIdx];
      const pMins = pItem.actualMinutes ?? pItem.plannedMinutes;
      result.push({ ...pItem, _scheduledTime: pItem.startAt });
      currentTime = Math.max(currentTime, nextPinTime + pMins);
      pinnedIdx++;
    } else {
      const item = unpinned[unpinnedIdx];
      const mins = item.actualMinutes ?? item.plannedMinutes;
      result.push({ ...item, _scheduledTime: minutesToTime(currentTime) });
      currentTime += mins;
      unpinnedIdx++;
    }
  }

  return result.map((item) => ({
    id: item.id,
    title: item.title,
    planned_minutes: item.plannedMinutes,
    actual_minutes: item.actualMinutes,
    completed: item.completed,
    is_recurring: item.isRecurring,
    start_at: item.startAt || null,
    sort_order: item.sortOrder,
    scheduled_time: item._scheduledTime,
    scheduled_time_display: formatTime12h(item._scheduledTime)
  }));
}

async function ensureTemplate(userId) {
  let template = await prisma.dayPlanTemplate.findUnique({
    where: { userId }
  });
  if (!template) {
    template = await prisma.dayPlanTemplate.create({
      data: { userId, defaultStartTime: '08:00' }
    });
  }
  return template;
}

async function addToTemplate(userId, title, minutes, startAt) {
  const template = await ensureTemplate(userId);
  const existing = await prisma.dayPlanTemplateItem.findFirst({
    where: { templateId: template.id, title }
  });
  if (existing) return;
  const maxOrder = await prisma.dayPlanTemplateItem.aggregate({
    where: { templateId: template.id },
    _max: { sortOrder: true }
  });
  await prisma.dayPlanTemplateItem.create({
    data: {
      templateId: template.id,
      title,
      defaultMinutes: minutes,
      startAt: startAt || null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1
    }
  });
}

async function removeFromTemplate(userId, title) {
  const template = await prisma.dayPlanTemplate.findUnique({
    where: { userId }
  });
  if (!template) return;
  await prisma.dayPlanTemplateItem.deleteMany({
    where: { templateId: template.id, title }
  });
}

// Get or create today's template
router.get('/template', authenticateToken, async (req, res) => {
  try {
    let template = await prisma.dayPlanTemplate.findUnique({
      where: { userId: req.user.userId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } }
      }
    });

    if (!template) {
      template = await prisma.dayPlanTemplate.create({
        data: {
          userId: req.user.userId,
          defaultStartTime: '08:00',
          items: {
            create: [
              { title: 'Morning routine', defaultMinutes: 30, sortOrder: 0 },
              { title: 'Deep work block 1', defaultMinutes: 90, sortOrder: 1 },
              { title: 'Break', defaultMinutes: 15, sortOrder: 2 },
              { title: 'Deep work block 2', defaultMinutes: 90, sortOrder: 3 },
              { title: 'Lunch', defaultMinutes: 45, sortOrder: 4 },
              { title: 'Meetings / calls', defaultMinutes: 60, sortOrder: 5 },
              { title: 'Admin / emails', defaultMinutes: 30, sortOrder: 6 },
              { title: 'Exercise', defaultMinutes: 45, sortOrder: 7 },
              { title: 'Wind down', defaultMinutes: 30, sortOrder: 8 }
            ]
          }
        },
        include: {
          items: { orderBy: { sortOrder: 'asc' } }
        }
      });
    }

    res.json({
      template: {
        id: template.id,
        default_start_time: template.defaultStartTime,
        items: template.items.map((i) => ({
          id: i.id,
          title: i.title,
          default_minutes: i.defaultMinutes,
          start_at: i.startAt || null,
          sort_order: i.sortOrder
        }))
      }
    });
  } catch (e) {
    console.error('Day plan template GET error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update template (start time, items)
router.put('/template', authenticateToken, async (req, res) => {
  const { default_start_time, items } = req.body;

  try {
    let template = await prisma.dayPlanTemplate.findUnique({
      where: { userId: req.user.userId }
    });

    if (!template) {
      template = await prisma.dayPlanTemplate.create({
        data: { userId: req.user.userId, defaultStartTime: default_start_time || '08:00' }
      });
    } else if (default_start_time) {
      await prisma.dayPlanTemplate.update({
        where: { id: template.id },
        data: { defaultStartTime: default_start_time }
      });
    }

    if (Array.isArray(items)) {
      await prisma.dayPlanTemplateItem.deleteMany({ where: { templateId: template.id } });
      await prisma.dayPlanTemplateItem.createMany({
        data: items.map((item, idx) => ({
          templateId: template.id,
          title: item.title,
          defaultMinutes: item.default_minutes || 30,
          startAt: item.start_at || null,
          sortOrder: item.sort_order ?? idx
        }))
      });
    }

    const updated = await prisma.dayPlanTemplate.findUnique({
      where: { id: template.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    });

    res.json({
      template: {
        id: updated.id,
        default_start_time: updated.defaultStartTime,
        items: updated.items.map((i) => ({
          id: i.id,
          title: i.title,
          default_minutes: i.defaultMinutes,
          start_at: i.startAt || null,
          sort_order: i.sortOrder
        }))
      }
    });
  } catch (e) {
    console.error('Day plan template PUT error:', e);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Get today's day plan (or specific date)
router.get('/', authenticateToken, async (req, res) => {
  const date = req.query.date || todayDate();

  try {
    let plan = await prisma.dayPlan.findFirst({
      where: { userId: req.user.userId, date: new Date(date + 'T00:00:00Z') },
      include: { items: { orderBy: { sortOrder: 'asc' } } }
    });

    if (!plan) {
      const template = await prisma.dayPlanTemplate.findUnique({
        where: { userId: req.user.userId },
        include: { items: { orderBy: { sortOrder: 'asc' } } }
      });

      const startTime = template?.defaultStartTime || '08:00';
      const templateItems = template?.items || [];

      plan = await prisma.dayPlan.create({
        data: {
          userId: req.user.userId,
          date: new Date(date + 'T00:00:00Z'),
          startTime,
          templateId: template?.id || null,
          items: {
            create: templateItems.map((ti) => ({
              title: ti.title,
              plannedMinutes: ti.defaultMinutes,
              isRecurring: true,
              startAt: ti.startAt || null,
              sortOrder: ti.sortOrder
            }))
          }
        },
        include: { items: { orderBy: { sortOrder: 'asc' } } }
      });
    }

    const enriched = enrichItems(plan.items, plan.startTime);
    const totalPlanned = plan.items.reduce((s, i) => s + i.plannedMinutes, 0);
    const totalActual = plan.items.reduce((s, i) => s + (i.actualMinutes ?? 0), 0);
    const completedCount = plan.items.filter((i) => i.completed).length;

    let latestEnd = timeToMinutes(plan.startTime);
    for (const item of enriched) {
      const endMins = timeToMinutes(item.scheduled_time) + (item.actual_minutes ?? item.planned_minutes);
      if (endMins > latestEnd) latestEnd = endMins;
    }

    res.json({
      plan: {
        id: plan.id,
        date,
        start_time: plan.startTime,
        items: enriched,
        total_planned_minutes: totalPlanned,
        total_actual_minutes: totalActual,
        completed_count: completedCount,
        total_count: plan.items.length,
        end_time: minutesToTime(latestEnd),
        end_time_display: formatTime12h(minutesToTime(latestEnd))
      }
    });
  } catch (e) {
    console.error('Day plan GET error:', e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update today's start time
router.patch('/start-time', authenticateToken, async (req, res) => {
  const date = req.body.date || todayDate();
  const { start_time } = req.body;
  if (!start_time) return res.status(400).json({ error: 'start_time required' });

  try {
    const plan = await prisma.dayPlan.findFirst({
      where: { userId: req.user.userId, date: new Date(date + 'T00:00:00Z') }
    });
    if (!plan) return res.status(404).json({ error: 'No plan for this date' });

    await prisma.dayPlan.update({
      where: { id: plan.id },
      data: { startTime: start_time }
    });
    res.json({ message: 'Updated' });
  } catch (e) {
    console.error('Day plan start-time error:', e);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// Update a single day plan item (including recurring toggle)
router.patch('/items/:itemId', authenticateToken, async (req, res) => {
  const itemId = Number(req.params.itemId);
  const { planned_minutes, actual_minutes, completed, title, is_recurring, start_at } = req.body;

  try {
    const item = await prisma.dayPlanItem.findFirst({
      where: { id: itemId },
      include: { dayPlan: { select: { userId: true } } }
    });
    if (!item || item.dayPlan.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const data = {};
    if (planned_minutes !== undefined) data.plannedMinutes = Number(planned_minutes);
    if (actual_minutes !== undefined) data.actualMinutes = actual_minutes === null ? null : Number(actual_minutes);
    if (completed !== undefined) data.completed = Boolean(completed);
    if (title !== undefined) data.title = title;
    if (is_recurring !== undefined) data.isRecurring = Boolean(is_recurring);
    if (start_at !== undefined) data.startAt = start_at || null;

    await prisma.dayPlanItem.update({ where: { id: itemId }, data });

    if (is_recurring !== undefined) {
      const itemTitle = title ?? item.title;
      const itemMinutes = planned_minutes != null ? Number(planned_minutes) : item.plannedMinutes;
      const itemStartAt = start_at !== undefined ? (start_at || null) : item.startAt;
      if (is_recurring) {
        await addToTemplate(req.user.userId, itemTitle, itemMinutes, itemStartAt);
      } else {
        await removeFromTemplate(req.user.userId, itemTitle);
      }
    }

    res.json({ message: 'Updated' });
  } catch (e) {
    console.error('Day plan item PATCH error:', e);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Add a new item to today's plan
router.post('/items', authenticateToken, async (req, res) => {
  const date = req.body.date || todayDate();
  const { title, planned_minutes = 30, is_recurring = false, start_at } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  try {
    const plan = await prisma.dayPlan.findFirst({
      where: { userId: req.user.userId, date: new Date(date + 'T00:00:00Z') },
      include: { items: true }
    });
    if (!plan) return res.status(404).json({ error: 'No plan for this date' });

    const maxOrder = plan.items.reduce((max, i) => Math.max(max, i.sortOrder), -1);
    const item = await prisma.dayPlanItem.create({
      data: {
        dayPlanId: plan.id,
        title,
        plannedMinutes: Number(planned_minutes),
        isRecurring: Boolean(is_recurring),
        startAt: start_at || null,
        sortOrder: maxOrder + 1
      }
    });

    if (is_recurring) {
      await addToTemplate(req.user.userId, title, Number(planned_minutes), start_at || null);
    }

    res.status(201).json({
      item: {
        id: item.id,
        title: item.title,
        planned_minutes: item.plannedMinutes,
        actual_minutes: item.actualMinutes,
        completed: item.completed,
        is_recurring: item.isRecurring,
        start_at: item.startAt || null,
        sort_order: item.sortOrder
      }
    });
  } catch (e) {
    console.error('Day plan add item error:', e);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Delete an item from today's plan
router.delete('/items/:itemId', authenticateToken, async (req, res) => {
  const itemId = Number(req.params.itemId);
  try {
    const item = await prisma.dayPlanItem.findFirst({
      where: { id: itemId },
      include: { dayPlan: { select: { userId: true } } }
    });
    if (!item || item.dayPlan.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.isRecurring) {
      await removeFromTemplate(req.user.userId, item.title);
    }

    await prisma.dayPlanItem.delete({ where: { id: itemId } });
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('Day plan delete item error:', e);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

module.exports = router;
