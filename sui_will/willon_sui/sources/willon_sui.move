
module willon_sui::willon_sui {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::balance;
    use sui::event;
    use sui::table::{Self, Table};
    use sui::vec_map::{Self, VecMap};

    public struct Will has key, store {
        id: object::UID,
        owner: address,
        index: u64, 
        heirs: vector<address>,
        shares: vector<u64>, 
        executed: bool,
    }
    public struct AdminCap has key, store {
        id: object::UID,


    }
    public struct WillStore has key {
        id: object::UID,
        wills: Table<address, VecMap<u64, Will>>,
    }
    public struct WillCreated has copy, drop {
        owner: address,
        index: u64,

    }
    public struct WillExecuted has copy, drop {
        owner: address,
        index: u64,
        heirs: vector<address>,
        total: u64,
    }
    public struct WillRevoked has copy, drop {
        owner: address,
        index: u64,



    }
    public struct WillView has copy, drop {
        index: u64,
        heirs: vector<address>,
        shares: vector<u64>,
        executed: bool,


    }
    const EInvalidSharesLength: u64 = 1;
    const ETooManyHeirs: u64 = 2;
    const EInvalidSharesSum: u64 = 3;
    const EWillNotFound: u64 = 4;
    const EWillExecuted: u64 = 5;
    const EWillAlreadyExecuted: u64 = 6;
    const EUnauthorized: u64 = 7;


    fun init(ctx: &mut tx_context::TxContext) {
        let store = WillStore {
            id: object::new(ctx),
            wills: table::new(ctx),
        };
        transfer::share_object(store);
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::public_transfer(admin_cap, tx_context::sender(ctx));
    }
    public entry fun create_will(
        store: &mut WillStore,
        heirs: vector<address>,
        shares: vector<u64>,
        ctx: &mut tx_context::TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(vector::length(&heirs) == vector::length(&shares), EInvalidSharesLength);
        assert!(vector::length(&heirs) <= 5, ETooManyHeirs);

        let mut total: u64 = 0;
        let len = vector::length(&shares);
        let mut i = 0;
        while (i < len) {
            total = total + *vector::borrow(&shares, i);
            i = i + 1;
        };
        assert!(total == 10000, EInvalidSharesSum);

        let wills = if (table::contains(&store.wills, sender)) {
            table::borrow_mut(&mut store.wills, sender)
        } else {
            let new_wills = vec_map::empty();
            table::add(&mut store.wills, sender, new_wills);
            table::borrow_mut(&mut store.wills, sender)
        };

        let index = vec_map::size(wills);
        let will = Will {
            id: object::new(ctx),
            owner: sender,
            index,
            heirs,
            shares,
            executed: false,
        };
        vec_map::insert(wills, index, will);
        event::emit(WillCreated { owner: sender, index });


    }
    public entry fun execute_will(
        _cap: &AdminCap,
        store: &mut WillStore,
        user: address,
        index: u64,
        coin: Coin<SUI>,
        ctx: &mut tx_context::TxContext,
    )
    {
        assert!(table::contains(&store.wills, user), EWillNotFound);
        let wills = table::borrow_mut(&mut store.wills, user);
        assert!(vec_map::contains(wills, &index), EWillNotFound);
        let (_, will) = vec_map::remove(wills, &index); 
        assert!(!will.executed, EWillExecuted);

        let mut balance = coin::into_balance(coin);
        let amount = balance::value(&balance);
        let heirs_copy = will.heirs;
        let len = vector::length(&heirs_copy);
        let mut i = 0;
        let mut remainder = amount; 
        while (i < len) {
            let heir = *vector::borrow(&heirs_copy, i);
            let share = *vector::borrow(&will.shares, i);
            let part_amount = amount * share / 10000;
            remainder = remainder - part_amount;
            let split_balance = balance::split(&mut balance, part_amount);
            let split_coin = coin::from_balance(split_balance, ctx);
            transfer::public_transfer(split_coin, heir);
            i = i + 1;
        };

        
        if (remainder > 0) {
            let first_heir = *vector::borrow(&heirs_copy, 0);
            let split_balance = balance::split(&mut balance, remainder);
            let split_coin = coin::from_balance(split_balance, ctx);
            transfer::public_transfer(split_coin, first_heir);
        };
        balance::destroy_zero(balance);

        let mut will = will;
        will.executed = true;
        vec_map::insert(wills, index, will);
        event::emit(WillExecuted { owner: user, index, heirs: heirs_copy, total: amount });
    }

    
    public entry fun revoke_will(
        store: &mut WillStore,
        index: u64,
        ctx: &mut tx_context::TxContext,
    ) {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&store.wills, sender), EWillNotFound);
        let wills = table::borrow_mut(&mut store.wills, sender);
        assert!(vec_map::contains(wills, &index), EWillNotFound);
        let (_, will) = vec_map::remove(wills, &index); 
        assert!(will.owner == sender, EUnauthorized);
        assert!(!will.executed, EWillAlreadyExecuted);
        let Will { id, owner: _, index: _, heirs: _, shares: _, executed: _ } = will;
        object::delete(id);
        event::emit(WillRevoked { owner: sender, index });
    }
    public fun get_will(
        store: &WillStore, 
        owner: address, 
        index: u64
    ): WillView {
        assert!(table::contains(&store.wills, owner), EWillNotFound);
        let wills_map = table::borrow(&store.wills, owner);
        assert!(vec_map::contains(wills_map, &index), EWillNotFound);
        
        let will_ref = vec_map::get(wills_map, &index);
        WillView {
            index: will_ref.index,
            heirs: will_ref.heirs,
            shares: will_ref.shares,
            executed: will_ref.executed,
        }
    }    
    public fun get_all_wills(
        store: &WillStore, 
        owner: address
    ): vector<WillView> {
        if (!table::contains(&store.wills, owner)) {
            return vector[]
        };
        
        let wills_map = table::borrow(&store.wills, owner);
        let size = vec_map::size(wills_map);
        let mut result = vector[];
        let mut i = 0;
        
        while (i < size) {
            if (vec_map::contains(wills_map, &i)) {
                let will_ref = vec_map::get(wills_map, &i);
                vector::push_back(
                    &mut result,
                    WillView {
                        index: will_ref.index,
                        heirs: will_ref.heirs,
                        shares: will_ref.shares,
                        executed: will_ref.executed,
                    }
                );
            };
            i = i + 1;
        };
        result
    }
}













