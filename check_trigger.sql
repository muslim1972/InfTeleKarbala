SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'cleanup_request_notifications_on_process';
