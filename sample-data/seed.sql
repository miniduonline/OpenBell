-- Sample data for OpenBell — useful for development & demos

INSERT INTO sounds (name, file_path, duration_sec, volume, is_default) VALUES
  ('Classic School Bell', 'assets/sounds/classic-bell.mp3', 3.5, 85, 1),
  ('Soft Chime', 'assets/sounds/soft-chime.mp3', 2.8, 70, 0),
  ('Digital Buzzer', 'assets/sounds/digital-buzzer.mp3', 1.5, 90, 0);

INSERT INTO schedules (title, day_of_week, ring_time, sound_id, category, sort_order) VALUES
  ('Morning Assembly', 1, '07:45', 1, 'assembly', 1),
  ('Period 1 Start', 1, '08:00', 1, 'class', 2),
  ('Period 1 End', 1, '08:40', 1, 'class', 3),
  ('Short Break', 1, '08:40', 2, 'break', 4),
  ('Period 2 Start', 1, '08:55', 1, 'class', 5),
  ('Lunch Break', 1, '12:00', 2, 'break', 6),
  ('Last Bell', 1, '14:30', 3, 'class', 7);

-- Duplicate the same pattern for Tue-Fri (2-5)
INSERT INTO schedules (title, day_of_week, ring_time, sound_id, category, sort_order)
SELECT title, d.day, ring_time, sound_id, category, sort_order
FROM schedules, (SELECT 2 AS day UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) d
WHERE schedules.day_of_week = 1;

INSERT INTO holidays (title, date, type, description) VALUES
  ('Independence Day', '2026-02-04', 'public', 'National holiday'),
  ('Mid-Term Break', '2026-04-13', 'school', 'School vacation week'),
  ('Vesak Full Moon Poya', '2026-05-31', 'public', 'Buddhist religious holiday');
