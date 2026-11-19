<?php

namespace Tests\Unit;

use App\Models\Account;
use App\Services\AccountSettings;
use InvalidArgumentException;
use Tests\TestCase;

class AccountSettingsTest extends TestCase
{
    public function test_it_refuses_to_activate_an_account_without_a_limit(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new AccountSettings())->activate(new Account(['name' => 'Main', 'daily_limit' => 0]));
    }

    public function test_it_activates_an_account_with_a_limit(): void
    {
        $account = (new AccountSettings())->activate(new Account(['name' => 'Main', 'daily_limit' => 500]));

        $this->assertNotNull($account->activated_at);
    }

    public function test_it_renames_an_account(): void
    {
        $account = (new AccountSettings())->update(new Account(['name' => 'Main', 'daily_limit' => 500]), ['name' => 'Shop']);

        $this->assertSame('Shop', $account->name);
    }

    public function test_it_refuses_to_set_the_limit_to_zero_after_activation(): void
    {
        $account = (new AccountSettings())->activate(new Account(['name' => 'Main', 'daily_limit' => 500]));

        $this->expectException(InvalidArgumentException::class);

        (new AccountSettings())->update($account, ['daily_limit' => 0]);
    }
}
