<?php

namespace App\Services;

use App\Models\Account;
use InvalidArgumentException;

class AccountSettings
{
    public function activate(Account $account): Account
    {
        if ($account->daily_limit <= 0) {
            throw new InvalidArgumentException('The daily limit must be greater than zero before activation.');
        }

        $account->activated_at = now();
        $account->save();

        return $account;
    }

    public function update(Account $account, array $data): Account
    {
        $limit = $data['daily_limit'] ?? $account->daily_limit;

        if ($account->activated_at !== null && $limit <= 0) {
            throw new InvalidArgumentException('The daily limit of an activated account must stay greater than zero.');
        }

        $account->name = $data['name'] ?? $account->name;
        $account->daily_limit = $limit;
        $account->save();

        return $account;
    }
}
