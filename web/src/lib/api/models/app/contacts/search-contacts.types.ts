export type SearchContactsSortBy =
    | 'created_at'
    | 'updated_at'
    | 'first_name'
    | 'last_name'
    | 'email'
    | 'company'
    | 'phone'
    | 'campaign_count'
    | 'mail_host'
    | `custom:${string}`;

export type SearchContactsFilterType =
    'equal' | 'starts_with' | 'ends_with' | 'contains';
