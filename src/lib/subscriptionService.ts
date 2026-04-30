import { supabase } from './supabaseClient';

export type SubscriptionTier = 'free' | 'premium';

export interface UserSubscriptionRecord {
    user_id: string;
    email: string | null;
    customer_id?: string | null;
    tier: SubscriptionTier | string;
    status: string | null;
    current_period_end: string | null;
    updated_at: string | null;
}

const inactiveStatuses = new Set(['canceled', 'cancelled', 'expired', 'inactive', 'past_due', 'paused']);

export function isPremiumSubscription(subscription: UserSubscriptionRecord | null | undefined): boolean {
    if (!subscription) return false;

    const tier = String(subscription.tier || '').toLowerCase();
    const status = String(subscription.status || '').toLowerCase();
    const customerId = String(subscription.customer_id || '').trim();

    if (!customerId) return false;
    
    let isPeriodActive = false;
    if (subscription.current_period_end) {
        const periodEnd = new Date(subscription.current_period_end).getTime();
        if (periodEnd > Date.now()) {
            isPeriodActive = true;
        }
    }

    if (inactiveStatuses.has(status)) {
        if (isPeriodActive) return true;
        return false;
    }

    return tier === 'premium' || tier === 'unlimited' || status === 'active' || status === 'trialing' || isPeriodActive;
}

export function getSubscriptionPlanLabel(subscription: UserSubscriptionRecord | null | undefined): string {
    return isPremiumSubscription(subscription) ? 'Zemly Unlimited' : 'Free';
}

export async function getUserSubscription(userId?: string, email?: string | null): Promise<UserSubscriptionRecord | null> {
    if (!userId && !email) return null;

    const lookup = async (column: 'user_id' | 'email', value: string) => {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq(column, value)
            .maybeSingle();

        if (error) {
            if (error.code === 'PGRST205' || /could not find the table/i.test(error.message || '')) {
                return null;
            }
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        return (data as UserSubscriptionRecord | null) ?? null;
    };

    if (userId) {
        const byUserId = await lookup('user_id', userId);
        if (byUserId) return byUserId;
    }

    if (email) {
        return await lookup('email', email);
    }

    return null;
}
