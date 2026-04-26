UPDATE ledger_entries SET entry_type = 'FEE' WHERE entry_type::text = 'CHARGE';
