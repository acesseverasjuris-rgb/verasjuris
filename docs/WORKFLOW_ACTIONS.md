# Workflow Actions

Somente ações **registradas** (ADR 207): create_task, create_notification, send_communication, request_approval, create_deadline, update_allowed_field, create_document_request, create_incident, create_payable, call_internal_service, enqueue_job, wait, webhook_external.

Cada ação pode declarar `failurePolicy`: stop | continue | retry | escalate | wait_for_review.
