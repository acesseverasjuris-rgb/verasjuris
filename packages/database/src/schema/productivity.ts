import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { administrativeProcesses } from "./administrative.js";
import { organizationMembers, organizations, users } from "./identity.js";
import { judicialHearings, judicialProcesses } from "./judicial.js";
import { legalMatters } from "./matters.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
};

/* ─── Tasks ─── */

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
  "archived",
]);

export const taskPriorityEnum = pgEnum("task_priority", ["low", "normal", "high", "urgent"]);

export const taskDependencyTypeEnum = pgEnum("task_dependency_type", ["blocks", "requires"]);

export const taskSlaStatusEnum = pgEnum("task_sla_status", [
  "running",
  "paused",
  "warning",
  "breached",
  "completed",
  "cancelled",
]);

export const slaPolicies = pgTable(
  "sla_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    targetMinutes: integer("target_minutes").notNull(),
    warningMinutes: integer("warning_minutes"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("sla_policies_org_idx").on(table.organizationId),
    uniqueIndex("sla_policies_org_name_unique").on(table.organizationId, table.name),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "set null",
    }),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    parentTaskId: uuid("parent_task_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("normal"),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    startAt: timestamp("start_at", { withTimezone: true, mode: "date" }),
    dueAt: timestamp("due_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "date" }),
    slaPolicyId: uuid("sla_policy_id").references(() => slaPolicies.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    index("tasks_org_idx").on(table.organizationId),
    index("tasks_org_status_idx").on(table.organizationId, table.status),
    index("tasks_responsible_idx").on(table.organizationId, table.responsibleMembershipId),
    index("tasks_matter_idx").on(table.legalMatterId),
    index("tasks_due_idx").on(table.organizationId, table.dueAt),
  ],
);

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    completedByMembershipId: uuid("completed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("task_checklist_task_idx").on(table.taskId),
    index("task_checklist_org_idx").on(table.organizationId),
  ],
);

export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnTaskId: uuid("depends_on_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependencyType: taskDependencyTypeEnum("dependency_type").notNull().default("blocks"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("task_dependencies_unique").on(table.taskId, table.dependsOnTaskId),
    index("task_dependencies_org_idx").on(table.organizationId),
  ],
);

export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorMembershipId: uuid("author_membership_id")
      .notNull()
      .references(() => organizationMembers.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
    ...timestamps,
  },
  (table) => [
    index("task_comments_task_idx").on(table.taskId),
    index("task_comments_org_idx").on(table.organizationId),
  ],
);

export const taskSlaInstances = pgTable(
  "task_sla",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    slaPolicyId: uuid("sla_policy_id")
      .notNull()
      .references(() => slaPolicies.id, { onDelete: "restrict" }),
    targetAt: timestamp("target_at", { withTimezone: true, mode: "date" }).notNull(),
    warningAt: timestamp("warning_at", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    pausedAt: timestamp("paused_at", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    status: taskSlaStatusEnum("status").notNull().default("running"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("task_sla_task_unique").on(table.taskId),
    index("task_sla_org_idx").on(table.organizationId),
  ],
);

export const taskHistoryEvents = pgTable(
  "task_history_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    eventAt: timestamp("event_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("task_history_task_idx").on(table.taskId),
    index("task_history_event_at_idx").on(table.taskId, table.eventAt),
  ],
);

/* ─── Calendar ─── */

export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "hearing",
  "expert_exam",
  "meeting",
  "consultation",
  "oral_argument",
  "internal_event",
  "other",
]);

export const calendarEventStatusEnum = pgEnum("calendar_event_status", [
  "scheduled",
  "confirmed",
  "rescheduled",
  "completed",
  "cancelled",
]);

export const calendarLocationTypeEnum = pgEnum("calendar_location_type", [
  "in_person",
  "remote",
  "hybrid",
  "undetermined",
]);

export const calendarRecurrenceEnum = pgEnum("calendar_recurrence", [
  "none",
  "daily",
  "weekly",
  "monthly",
]);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "set null",
    }),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    /** SSOT: audiência judicial existente; não duplicar hearing. */
    judicialHearingId: uuid("judicial_hearing_id").references(() => judicialHearings.id, {
      onDelete: "set null",
    }),
    eventType: calendarEventTypeEnum("event_type").notNull().default("other"),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    allDay: boolean("all_day").notNull().default(false),
    locationType: calendarLocationTypeEnum("location_type").notNull().default("undetermined"),
    locationText: text("location_text"),
    meetingUrl: text("meeting_url"),
    status: calendarEventStatusEnum("status").notNull().default("scheduled"),
    recurrence: calendarRecurrenceEnum("recurrence").notNull().default("none"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("calendar_events_org_idx").on(table.organizationId),
    index("calendar_events_starts_idx").on(table.organizationId, table.startsAt),
    index("calendar_events_responsible_idx").on(
      table.organizationId,
      table.responsibleMembershipId,
    ),
    uniqueIndex("calendar_events_hearing_unique").on(table.judicialHearingId),
  ],
);

export const calendarEventParticipants = pgTable(
  "calendar_event_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    calendarEventId: uuid("calendar_event_id")
      .notNull()
      .references(() => calendarEvents.id, { onDelete: "cascade" }),
    membershipId: uuid("membership_id").references(() => organizationMembers.id, {
      onDelete: "cascade",
    }),
    displayName: text("display_name"),
    email: text("email"),
    roleLabel: text("role_label"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("calendar_participants_event_idx").on(table.calendarEventId),
    index("calendar_participants_org_idx").on(table.organizationId),
  ],
);

/* ─── Deadlines (domínio central) ─── */

export const deadlineStatusEnum = pgEnum("deadline_status", [
  "draft",
  "suggested",
  "pending_confirmation",
  "confirmed",
  "completed",
  "cancelled",
]);

export const deadlineSourceTypeEnum = pgEnum("deadline_source_type", [
  "manual",
  "judicial_movement",
  "judicial_decision",
  "hearing",
  "administrative_requirement",
  "administrative_decision",
  "administrative_deadline",
  "contract",
  "other",
]);

export const deadlineRuleTypeEnum = pgEnum("deadline_rule_type", [
  "manual_date",
  "calendar_days",
  "business_days",
  "custom",
]);

export const deadlines = pgTable(
  "deadlines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    legalMatterId: uuid("legal_matter_id").references(() => legalMatters.id, {
      onDelete: "set null",
    }),
    judicialProcessId: uuid("judicial_process_id").references(() => judicialProcesses.id, {
      onDelete: "set null",
    }),
    administrativeProcessId: uuid("administrative_process_id").references(
      () => administrativeProcesses.id,
      { onDelete: "set null" },
    ),
    sourceType: deadlineSourceTypeEnum("source_type").notNull().default("manual"),
    sourceId: uuid("source_id"),
    title: text("title").notNull(),
    description: text("description"),
    baseDate: timestamp("base_date", { withTimezone: true, mode: "date" }).notNull(),
    baseDateLabel: text("base_date_label"),
    ruleType: deadlineRuleTypeEnum("rule_type").notNull().default("manual_date"),
    ruleDescription: text("rule_description"),
    ruleDays: integer("rule_days"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true, mode: "date" }),
    calculatedDueAt: timestamp("calculated_due_at", { withTimezone: true, mode: "date" }),
    confirmedDueAt: timestamp("confirmed_due_at", { withTimezone: true, mode: "date" }),
    status: deadlineStatusEnum("status").notNull().default("draft"),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    responsibleMembershipId: uuid("responsible_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    confirmedByMembershipId: uuid("confirmed_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
    createdByMembershipId: uuid("created_by_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    ...timestamps,
  },
  (table) => [
    index("deadlines_org_idx").on(table.organizationId),
    index("deadlines_org_status_idx").on(table.organizationId, table.status),
    index("deadlines_confirmed_due_idx").on(table.organizationId, table.confirmedDueAt),
    index("deadlines_matter_idx").on(table.legalMatterId),
    index("deadlines_source_idx").on(table.organizationId, table.sourceType, table.sourceId),
  ],
);

export const deadlineHistoryEvents = pgTable(
  "deadline_history_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    deadlineId: uuid("deadline_id")
      .notNull()
      .references(() => deadlines.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    previousValue: text("previous_value"),
    newValue: text("new_value"),
    reason: text("reason"),
    actorMembershipId: uuid("actor_membership_id").references(() => organizationMembers.id, {
      onDelete: "set null",
    }),
    eventAt: timestamp("event_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("deadline_history_deadline_idx").on(table.deadlineId),
    index("deadline_history_event_at_idx").on(table.deadlineId, table.eventAt),
  ],
);

export const deadlineAlertRules = pgTable(
  "deadline_alert_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    offsetMinutes: integer("offset_minutes").notNull(),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    index("deadline_alert_rules_org_idx").on(table.organizationId),
    uniqueIndex("deadline_alert_rules_org_offset_unique").on(
      table.organizationId,
      table.offsetMinutes,
    ),
  ],
);

export const deadlineEscalationRules = pgTable(
  "deadline_escalation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    offsetMinutes: integer("offset_minutes").notNull(),
    escalateToMembershipId: uuid("escalate_to_membership_id").references(
      () => organizationMembers.id,
      { onDelete: "set null" },
    ),
    escalateToRoleKey: text("escalate_to_role_key"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (table) => [index("deadline_escalation_rules_org_idx").on(table.organizationId)],
);

export const deadlineAlertDispatches = pgTable(
  "deadline_alert_dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    deadlineId: uuid("deadline_id")
      .notNull()
      .references(() => deadlines.id, { onDelete: "cascade" }),
    alertRuleId: uuid("alert_rule_id").references(() => deadlineAlertRules.id, {
      onDelete: "set null",
    }),
    channel: text("channel").notNull().default("in_app"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    notificationId: uuid("notification_id"),
  },
  (table) => [
    uniqueIndex("deadline_alert_dispatches_unique").on(
      table.deadlineId,
      table.alertRuleId,
      table.channel,
    ),
    index("deadline_alert_dispatches_org_idx").on(table.organizationId),
  ],
);

/* ─── Notifications (in-app) ─── */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    resourceType: text("resource_type"),
    resourceId: uuid("resource_id"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId, table.readAt),
    index("notifications_org_idx").on(table.organizationId),
  ],
);

/* ─── Relations ─── */

export const slaPoliciesRelations = relations(slaPolicies, ({ many }) => ({
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  checklistItems: many(taskChecklistItems),
  comments: many(taskComments),
  history: many(taskHistoryEvents),
  sla: one(taskSlaInstances),
}));

export const taskChecklistItemsRelations = relations(taskChecklistItems, ({ one }) => ({
  task: one(tasks, { fields: [taskChecklistItems.taskId], references: [tasks.id] }),
}));

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  task: one(tasks, {
    fields: [taskDependencies.taskId],
    references: [tasks.id],
    relationName: "task_deps_from",
  }),
  dependsOn: one(tasks, {
    fields: [taskDependencies.dependsOnTaskId],
    references: [tasks.id],
    relationName: "task_deps_to",
  }),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, { fields: [taskComments.taskId], references: [tasks.id] }),
}));

export const taskSlaInstancesRelations = relations(taskSlaInstances, ({ one }) => ({
  task: one(tasks, { fields: [taskSlaInstances.taskId], references: [tasks.id] }),
  policy: one(slaPolicies, {
    fields: [taskSlaInstances.slaPolicyId],
    references: [slaPolicies.id],
  }),
}));

export const taskHistoryEventsRelations = relations(taskHistoryEvents, ({ one }) => ({
  task: one(tasks, { fields: [taskHistoryEvents.taskId], references: [tasks.id] }),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [calendarEvents.organizationId],
    references: [organizations.id],
  }),
  hearing: one(judicialHearings, {
    fields: [calendarEvents.judicialHearingId],
    references: [judicialHearings.id],
  }),
  participants: many(calendarEventParticipants),
}));

export const calendarEventParticipantsRelations = relations(
  calendarEventParticipants,
  ({ one }) => ({
    event: one(calendarEvents, {
      fields: [calendarEventParticipants.calendarEventId],
      references: [calendarEvents.id],
    }),
  }),
);

export const deadlinesRelations = relations(deadlines, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [deadlines.organizationId],
    references: [organizations.id],
  }),
  history: many(deadlineHistoryEvents),
}));

export const deadlineHistoryEventsRelations = relations(deadlineHistoryEvents, ({ one }) => ({
  deadline: one(deadlines, {
    fields: [deadlineHistoryEvents.deadlineId],
    references: [deadlines.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));
