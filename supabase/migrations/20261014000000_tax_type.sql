-- Tax deductions: an expense can be marked as the kind of deduction it counts
-- towards (life insurance, RMF, donations…) so the app can total them for the
-- tax year. Only expenses carry one.
alter table public.transactions
  add column tax_type text
    check (tax_type in ('life', 'health', 'parentHealth', 'homeLoan', 'rmf', 'thaiesg', 'donation', 'donationDouble', 'easyReceipt', 'other')),
  add constraint transactions_tax_out check (tax_type is null or type = 'out');
