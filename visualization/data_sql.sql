SELECT date_trunc('month', from_unixtime(message_timestamp)) AS month_start,
    message_timestamp,
    CAST (infared_temps as JSON) AS infared_temps,
    probe_temps.top AS probe_temp_top
FROM esp32_test_infared_datastore
WHERE date_trunc('month', from_unixtime(message_timestamp)) = date_trunc('month', now())
ORDER BY message_timestamp ASC;