
#[test_only]
module willon_sui::willon_sui_test {
    use sui::test_scenario::{Self, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::table;
    use sui::vec_map;
    use willon_sui::willon_sui::{Self, AdminCap, WillStore, WillIsCreated, WillIsExecuted, WillIsRevoked};

    const EInvalidSharesLength: u64 = 1;
    const EIncorrectSumShares: u64 = 2;
    const EWillCannotBeFound: u64 = 3;
    const EWillExecuted: u64 = 4;
    const EWillAlreadyExecuted: u64 = 5;
    const EUnauthorizedUser: u64 = 6;
    const EWillHasExecutedAlready: u64 = 7;
    const ETooEarlyToExecute: u64 = 8;

    fun setup(scenario: &mut Scenario): (address, address, address) {
        let admin = @0xA;
        let heir1 = @0xB;
        let heir2 = @0xC;

        test_scenario::begin(admin);
        {
            let ctx = test_scenario::ctx(scenario);
            willon_sui::init(ctx);
        };
        test_scenario::next_tx(scenario, admin);

        (admin, heir1, heir2)
    }

    #[test]
    fun test_init() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        {
            let ctx = test_scenario::ctx(scenario);
            willon_sui::init(ctx);
        };
        test_scenario::next_tx(scenario, @0xA);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            assert!(table::is_empty(&store.will_list), 0);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_create_will() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[5000, 5000]; 
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            let event = test_scenario::take_emitted_event<WillIsCreated>(scenario);
            assert!(event.owner == admin && event.index == 0, 0);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_create_multiple_wills() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs1 = vector[heir1, heir2];
            let shares1 = vector[5000, 5000];
            let heirs2 = vector[heir1];
            let shares2 = vector[10000];
            willon_sui::create_will(&mut store, heirs1, shares1, ctx);
            willon_sui::create_will(&mut store, heirs2, shares2, ctx);
            let event1 = test_scenario::take_emitted_event<WillIsCreated>(scenario);
            let event2 = test_scenario::take_emitted_event<WillIsCreated>(scenario);
            assert!(event1.owner == admin && event1.index == 0, 0);
            assert!(event2.owner == admin && event2.index == 1, 1);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EInvalidSharesLength)]
    fun test_create_will_invalid_shares_length() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[5000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EIncorrectSumShares)]
    fun test_create_will_invalid_shares_sum() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[6000, 5000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_execute_will() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[5000, 5000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            willon_sui::initiate_will_execution(&admin_cap, &mut store, admin, 0, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::next_epoch(scenario, admin);
        test_scenario::next_epoch(scenario, admin); 
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let coin = coin::mint_for_testing<SUI>(1000000000, ctx); 
            willon_sui::execute_will(&admin_cap, &mut store, admin, 0, coin, ctx);
            let event = test_scenario::take_emitted_event<WillIsExecuted>(scenario);
            assert!(event.owner == admin && event.index == 0, 0);
            assert!(event.heirs == vector[heir1, heir2], 1);
            assert!(event.total == 1000000000, 2);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::next_tx(scenario, heir1);
        {
            let coin1 = test_scenario::take_from_sender<Coin<SUI>>(scenario);
            assert!(coin::value(&coin1) == 500000000, 0); 
            test_scenario::return_to_sender(scenario, coin1);
        };
        test_scenario::next_tx(scenario, heir2);
        {
            let coin2 = test_scenario::take_from_sender<Coin<SUI>>(scenario);
            assert!(coin::value(&coin2) == 500000000, 1);
            test_scenario::return_to_sender(scenario, coin2);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = ETooEarlyToExecute)]
    fun test_execute_will_too_early() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[5000, 5000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            willon_sui::initiate_will_execution(&admin_cap, &mut store, admin, 0, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let coin = coin::mint_for_testing<SUI>(1000000000, ctx);
            willon_sui::execute_will(&admin_cap, &mut store, admin, 0, coin, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EWillExecuted)]
    fun test_execute_will_already_executed() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[5000, 5000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            willon_sui::initiate_will_execution(&admin_cap, &mut store, admin, 0, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::next_epoch(scenario, admin);
        test_scenario::next_epoch(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let coin = coin::mint_for_testing<SUI>(1000000000, ctx);
            willon_sui::execute_will(&admin_cap, &mut store, admin, 0, coin, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let coin = coin::mint_for_testing<SUI>(1000000000, ctx);
            willon_sui::execute_will(&admin_cap, &mut store, admin, 0, coin, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EWillCannotBeFound)]
    fun test_execute_will_not_found() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, _, _) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let coin = coin::mint_for_testing<SUI>(1000000000, ctx);
            willon_sui::execute_will(&admin_cap, &mut store, admin, 0, coin, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_revoke_will() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[5000, 5000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            willon_sui::revoke_will(&mut store, 0, ctx);
            let event = test_scenario::take_emitted_event<WillIsRevoked>(scenario);
            assert!(event.owner == admin && event.index == 0, 0);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EWillHasExecutedAlready)]
    fun test_revoke_will_already_executed() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[5000, 5000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            willon_sui::initiate_will_execution(&admin_cap, &mut store, admin, 0, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::next_epoch(scenario, admin);
        test_scenario::next_epoch(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let admin_cap = test_scenario::take_from_sender<AdminCap>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let coin = coin::mint_for_testing<SUI>(1000000000, ctx);
            willon_sui::execute_will(&admin_cap, &mut store, admin, 0, coin, ctx);
            test_scenario::return_shared(store);
            test_scenario::return_to_sender(scenario, admin_cap);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            willon_sui::revoke_will(&mut store, 0, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EWillCannotBeFound)]
    fun test_revoke_will_not_found() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, _, _) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            willon_sui::revoke_will(&mut store, 0, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    #[expected_failure(abort_code = EUnauthorizedUser)]
    fun test_revoke_will_unauthorized() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[5000, 5000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::next_tx(scenario, @0xD); 
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            willon_sui::revoke_will(&mut store, 0, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }

    #[test]
    fun test_get_will() {
        let mut scenario_val = test_scenario::begin(@0xA);
        let scenario = &mut scenario_val;
        let (admin, heir1, heir2) = setup(scenario);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let ctx = test_scenario::ctx(scenario);
            let heirs = vector[heir1, heir2];
            let shares = vector[3000, 7000];
            willon_sui::create_will(&mut store, heirs, shares, ctx);
            test_scenario::return_shared(store);
        };
        test_scenario::next_tx(scenario, admin);
        {
            let store = test_scenario::take_shared<WillStore>(scenario);
            let will_view = willon_sui::get_will(&store, admin, 0);
            assert!(&will_view.heirs == &vector[heir1, heir2], 0);
            assert!(&will_view.shares == &vector[3000, 7000], 1);
            assert!(!will_view.executed, 2);
            let all_wills = willon_sui::get_all_wills(&store, admin);
            assert!(vector::length(&all_wills) == 1, 3);
            let first_will = vector::borrow(&all_wills, 0);
            assert!(&first_will.heirs == &vector[heir1, heir2], 4);
            test_scenario::return_shared(store);
        };
        test_scenario::end(scenario_val);
    }
}










