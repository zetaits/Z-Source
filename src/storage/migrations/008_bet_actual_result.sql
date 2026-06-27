-- Realised outcome quantity for a settled bet (e.g. a pitcher's actual
-- strikeouts). NULL for bets settled before this column existed and for markets
-- with no numeric result. Lets the calibration view compare the model's fair
-- prob against the realised distance to the line, not just binary win/loss.
ALTER TABLE bets ADD COLUMN actual_result REAL;
