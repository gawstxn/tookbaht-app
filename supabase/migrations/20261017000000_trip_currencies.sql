-- Entries logged abroad in the trip's currency (yen, won, euro…). The app
-- converts at the entry date's rate and keeps the original amount, like USD
-- subscription charges. Rates for these currencies are stored the same way.
-- Only currencies the ECB publishes against THB (Frankfurter) are allowed.

alter table public.exchange_rates drop constraint exchange_rates_currency_check;
alter table public.exchange_rates add constraint exchange_rates_currency_check check (
  currency in ('USD', 'EUR', 'GBP', 'JPY', 'KRW', 'CNY', 'HKD', 'SGD', 'MYR', 'IDR', 'PHP', 'INR', 'AUD', 'NZD', 'CHF', 'CAD')
);

alter table public.transactions drop constraint transactions_orig_currency_check;
alter table public.transactions add constraint transactions_orig_currency_check check (
  orig_currency in ('USD', 'EUR', 'GBP', 'JPY', 'KRW', 'CNY', 'HKD', 'SGD', 'MYR', 'IDR', 'PHP', 'INR', 'AUD', 'NZD', 'CHF', 'CAD')
);

-- A won or rupiah is worth a few satang: keep enough digits for its rate.
alter table public.exchange_rates alter column rate type numeric(16, 8);
alter table public.transactions alter column fx_rate type numeric(16, 8);
