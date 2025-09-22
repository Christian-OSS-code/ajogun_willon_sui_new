
#[allow(lint(public_entry))]
module willon_sui::willon_sui {
    use sui::vec_map::{Self, VecMap};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::sui::SUI;
    use sui::balance;
    use sui::coin::{Self, Coin};
    use sui::dynamic_field;
    use sui::clock::{Self, Clock};

    public struct Will has key, store {
        id: UID,
        heirs: vector<address>,
        owner: address,
        shares: vector<u64>,
        index: u64,
        executed: bool,
        last_activity_time: u64,
        auto_execute_time: u64,
        execution_initiated: bool,
        requested_execution_time: u64,
    }

    public struct AdminCap has key, store {
        id: UID,
    }

    public struct WillStore has key {
        id: UID,
        will_list: Table<address, VecMap<u64, Will>>,
    }

    public struct WillIsCreated has copy, drop { 
        owner: address, 
        index: u64, 
    }
    public struct WillIsExecuted has copy, drop { 
        owner: address, 
        index: u64, 
        heirs: vector<address>, 
        total: u64, 
    }
    public struct WillIsRevoked has copy, drop { 
        owner: address, 
        index: u64, 
    }
    public struct WillIsViewed has copy, drop { 
        index: u64, 
        heirs: vector<address>, 
        shares: vector<u64>, 
        executed: bool, 
    }
    public struct ActivityUpdated has copy, drop {
        owner: address,
        index: u64,
        new_activity_time: u64,
    }
    const EInvalidSharesLength: u64 = 1;
    const EIncorrectSumShares: u64 = 2;
    const EWillCannotBeFound: u64 = 3;
    const EWillExecuted: u64 = 4;
    const EUnauthorizedUser: u64 = 6;
    const EWillHasExecutedAlready: u64 = 7;
    const ETooEarlyToExecute: u64 = 8;
    const EOnlyOwnerCanRevoke: u64 = 9;
    const EExecutionNotInitiated: u64 = 10;
    const ENotOwner: u64 = 11;

    fun init(ctx: &mut TxContext) {
        let will_store = WillStore {
            id: object::new(ctx),
            will_list: table::new(ctx)
        };
        transfer::share_object(will_store);

        let master_key = AdminCap { id: object::new(ctx) };
        transfer::transfer(master_key, tx_context::sender(ctx));
    }

    public entry fun create_will(
        will_store: &mut WillStore,
        heirs: vector<address>,
        shares: vector<u64>,
        coin: Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(vector::length(&heirs) == vector::length(&shares), EInvalidSharesLength);
        let length_of_shares = vector::length(&shares);
        let mut total: u64 = 0;
        let mut count_shares = 0;

        while (count_shares < length_of_shares) {
            total = total + *vector::borrow(&shares, count_shares);
            count_shares = count_shares + 1;
        };
        assert!(total == 10000, EIncorrectSumShares);

        if (!table::contains(&will_store.will_list, sender)) {
            let new_will = vec_map::empty();
            table::add(&mut will_store.will_list, sender, new_will);
        };
        
        let sender_wills = table::borrow_mut(&mut will_store.will_list, sender);
        let index = vec_map::size(sender_wills);
        let current_time = tx_context::epoch_timestamp_ms(ctx);

        let mut sender_will = Will {
            id: object::new(ctx),
            owner: sender,
            index,
            heirs,
            shares,
            executed: false,
            last_activity_time: current_time,
            auto_execute_time: current_time + 20000, 
            execution_initiated: false,
            requested_execution_time: 0,
        };

        dynamic_field::add(&mut sender_will.id, b"coin", coin);
        vec_map::insert(sender_wills, index, sender_will);
        
        event::emit(WillIsCreated { owner: sender, index });
    }
    public entry fun update_activity(
        will_store: &mut WillStore,
        index: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&will_store.will_list, sender), EWillCannotBeFound);
        let user_wills = table::borrow_mut(&mut will_store.will_list, sender);
        assert!(vec_map::contains(user_wills, &index), EWillCannotBeFound);
        let will = vec_map::get_mut(user_wills, &index);
        
        assert!(!will.executed, EWillExecuted);
        assert!(sender == will.owner, ENotOwner);
        
        let current_time = tx_context::epoch_timestamp_ms(ctx);
        will.last_activity_time = current_time;
        will.auto_execute_time = current_time + 20000; 
        
        event::emit(ActivityUpdated { 
            owner: sender, 
            index, 
            new_activity_time: current_time 
        });
    }

    public entry fun initiate_will_execution(
        will_store: &mut WillStore,
        owner: address,
        index: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&will_store.will_list, owner), EWillCannotBeFound);
        let user_wills = table::borrow_mut(&mut will_store.will_list, owner);
        assert!(vec_map::contains(user_wills, &index), EWillCannotBeFound);
        let will = vec_map::get_mut(user_wills, &index);

        let mut is_heir = false;
        let mut i = 0;
        let heirs_length = vector::length(&will.heirs);
        while (i < heirs_length) {
            if (*vector::borrow(&will.heirs, i) == sender) {
                is_heir = true;
                break 
            };
            i = i + 1;
        };
        assert!(is_heir || (sender == will.owner), EUnauthorizedUser);
        assert!(!will.executed, EWillExecuted);

        will.execution_initiated = true;
        will.requested_execution_time = tx_context::epoch_timestamp_ms(ctx);
    }

    public entry fun execute_will_automatically(
        will_store: &mut WillStore,
        owner: address,
        index: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(table::contains(&will_store.will_list, owner), EWillCannotBeFound);
        let user_wills = table::borrow_mut(&mut will_store.will_list, owner);
        assert!(vec_map::contains(user_wills, &index), EWillCannotBeFound);
        let (_, mut will) = vec_map::remove(user_wills, &index);
        
        assert!(!will.executed, EWillExecuted);
        
        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= will.auto_execute_time, ETooEarlyToExecute);
        
    
        let coin = dynamic_field::remove<vector<u8>, Coin<SUI>>(&mut will.id, b"coin");
        let mut balance = coin::into_balance(coin);
        let amount = balance::value(&balance);
        let heirs_copy = will.heirs;
        let heirs_list_length = vector::length(&heirs_copy);
        let mut heirs_count = 0;
        let mut remainder = amount;

        while (heirs_count < heirs_list_length) {
            let heir = *vector::borrow(&heirs_copy, heirs_count);
            let share = *vector::borrow(&will.shares, heirs_count);
            let heir_part_amount = (amount * share) / 10000;
            remainder = remainder - heir_part_amount;
            let splitted_balance = balance::split(&mut balance, heir_part_amount);
            let splitted_coin = coin::from_balance(splitted_balance, ctx);
            transfer::public_transfer(splitted_coin, heir);
            heirs_count = heirs_count + 1;
        };

        if (remainder > 0) {
            let splitted_coin = coin::from_balance(balance, ctx);
            transfer::public_transfer(splitted_coin, *vector::borrow(&heirs_copy, 0));
        } else {
            balance::destroy_zero(balance);
        };

        will.executed = true;
        vec_map::insert(user_wills, index, will);
        event::emit(WillIsExecuted { 
            owner, 
            index, 
            heirs: heirs_copy, 
            total: amount 
        });
    }
    public entry fun execute_will(
        will_store: &mut WillStore,
        owner: address,
        index: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&will_store.will_list, owner), EWillCannotBeFound);
        let user_wills = table::borrow_mut(&mut will_store.will_list, owner);
        assert!(vec_map::contains(user_wills, &index), EWillCannotBeFound);
        let (_, mut will) = vec_map::remove(user_wills, &index);

        let mut is_heir = false;
        let mut i = 0;
        let heirs_length = vector::length(&will.heirs);
        while (i < heirs_length) {
            if (*vector::borrow(&will.heirs, i) == sender) {
                is_heir = true;
                break 
            };
            i = i + 1;
        };
        assert!(is_heir, EUnauthorizedUser);
        assert!(!will.executed, EWillExecuted);
        assert!(will.execution_initiated, EExecutionNotInitiated);

        let current_time = clock::timestamp_ms(clock);
        assert!(current_time >= will.requested_execution_time + 20000, ETooEarlyToExecute);

        let coin = dynamic_field::remove<vector<u8>, Coin<SUI>>(&mut will.id, b"coin");
        let mut balance = coin::into_balance(coin);
        let amount = balance::value(&balance);
        let heirs_copy = will.heirs;
        let heirs_list_length = vector::length(&heirs_copy);
        let mut heirs_count = 0;
        let mut remainder = amount;

        while (heirs_count < heirs_list_length) {
            let heir = *vector::borrow(&heirs_copy, heirs_count);
            let share = *vector::borrow(&will.shares, heirs_count);
            let heir_part_amount = (amount * share) / 10000;
            remainder = remainder - heir_part_amount;
            let splitted_balance = balance::split(&mut balance, heir_part_amount);
            let splitted_coin = coin::from_balance(splitted_balance, ctx);
            transfer::public_transfer(splitted_coin, heir);
            heirs_count = heirs_count + 1;
        };

        if (remainder > 0) {
            let splitted_coin = coin::from_balance(balance, ctx);
            transfer::public_transfer(splitted_coin, *vector::borrow(&heirs_copy, 0));
        } else {
            balance::destroy_zero(balance);
        };

        will.executed = true;
        vec_map::insert(user_wills, index, will);
        event::emit(WillIsExecuted { 
            owner, 
            index, 
            heirs: heirs_copy, 
            total: amount 
        });
    }

    public entry fun revoke_will(
        will_store: &mut WillStore,
        index: u64,
        ctx: &mut TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&will_store.will_list, sender), EWillCannotBeFound);
        let wills = table::borrow_mut(&mut will_store.will_list, sender);
        assert!(vec_map::contains(wills, &index), EWillCannotBeFound);
        let (_, mut will) = vec_map::remove(wills, &index);
        assert!(will.owner == sender, EOnlyOwnerCanRevoke);
        assert!(!will.executed, EWillHasExecutedAlready);

        let coin = dynamic_field::remove<vector<u8>, Coin<SUI>>(&mut will.id, b"coin");
        transfer::public_transfer(coin, sender);

        let Will { id, .. } = will;
        object::delete(id);
        event::emit(WillIsRevoked { owner: sender, index });
    }

    public fun get_will(
        will_store: &WillStore,
        owner: address,
        index: u64
    ): WillIsViewed {
        assert!(table::contains(&will_store.will_list, owner), EWillCannotBeFound);
        let wills_map = table::borrow(&will_store.will_list, owner);
        assert!(vec_map::contains(wills_map, &index), EWillCannotBeFound);
        let will_ref = vec_map::get(wills_map, &index);

        WillIsViewed {
            index: will_ref.index,
            heirs: will_ref.heirs,
            shares: will_ref.shares,
            executed: will_ref.executed
        }
    }

    public fun get_all_wills(
        will_store: &WillStore,
        owner: address
    ): vector<WillIsViewed> {
        if (!table::contains(&will_store.will_list, owner)) {
            return vector::empty()
        };
        let wills_map = table::borrow(&will_store.will_list, owner);
        let number_of_wills = vec_map::size(wills_map);
        let mut will_summaries = vector::empty();
        let mut will_count = 0;

        while (will_count < number_of_wills) {
            if (vec_map::contains(wills_map, &will_count)) {
                let will_ref = vec_map::get(wills_map, &will_count);
                vector::push_back(
                    &mut will_summaries,
                    WillIsViewed {
                        index: will_ref.index,
                        heirs: will_ref.heirs,
                        shares: will_ref.shares,
                        executed: will_ref.executed
                    }
                );
            };
            will_count = will_count + 1;
        };
        will_summaries
    }
    
    public entry fun check_will_ready(
        will_store: &WillStore,
        owner: address,
        index: u64,
        clock: &Clock,
        ctx: &mut TxContext
) {
        let is_ready = is_will_ready_for_auto_execution(will_store, owner, index, clock);
        event::emit(WillReadyEvent { 
            is_ready, 
            owner, 
            index,
            timestamp: clock::timestamp_ms(clock)
        });
    }

    public fun is_will_ready_for_auto_execution(
        will_store: &WillStore,
        owner: address,
        index: u64,
        clock: &Clock
    ):  bool {
        if (!table::contains(&will_store.will_list, owner)) {
            return false
        };
        let wills_map = table::borrow(&will_store.will_list, owner);
        if (!vec_map::contains(wills_map, &index)) {
            return false
        };
        let will_ref = vec_map::get(wills_map, &index);
    
        !will_ref.executed && clock::timestamp_ms(clock) >= will_ref.auto_execute_time
    }

    public struct WillReadyEvent has copy, drop {
        is_ready: bool,
        owner: address,
        index: u64,
        timestamp: u64,
    }

}























