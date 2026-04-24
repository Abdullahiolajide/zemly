import { supabase } from './supabaseClient';
import { DodoPayments } from 'dodopayments-checkout';

/* ── Dodo Payments product ID (set after creating the product in the Dodo dashboard) ── */
const MONTHLY_DODO_PRODUCT_ID =
    import.meta.env.VITE_DODO_MONTHLY_PRODUCT_ID || import.meta.env.VITE_DODO_PRODUCT_ID || '';
const ANNUAL_DODO_PRODUCT_ID = import.meta.env.VITE_DODO_ANNUAL_PRODUCT_ID || '';

type BillingCycle = 'monthly' | 'annual';

type CheckoutEvent = {
    event_type: string;
    data?: { message?: string; [key: string]: unknown };
};

type CheckoutEventCallback = (event: CheckoutEvent) => void;

let sdkInitialised = false;
let checkoutEventHandler: CheckoutEventCallback | undefined;

function makeDodoOverlayTransparent(): void {
    const applyTransparency = () => {
        const candidates = Array.from(document.body.children).filter((node): node is HTMLElement => {
            if (!(node instanceof HTMLElement)) return false;

            const computedStyle = window.getComputedStyle(node);
            return computedStyle.position === 'fixed' && computedStyle.zIndex !== 'auto';
        });

        for (const candidate of candidates) {
            candidate.style.background = 'transparent';
            candidate.style.backgroundColor = 'transparent';
            candidate.style.backdropFilter = 'none';
        }
    };

    applyTransparency();

    const observer = new MutationObserver(() => {
        applyTransparency();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    window.setTimeout(() => observer.disconnect(), 5000);
}

function initDodoPayments(onEvent?: CheckoutEventCallback): void {
    checkoutEventHandler = onEvent;

    if (sdkInitialised) return;

    DodoPayments.Initialize({
        mode: (import.meta.env.VITE_DODO_MODE as 'test' | 'live') || 'test',
        displayType: 'overlay',
        onEvent: (event) => {
            checkoutEventHandler?.(event as CheckoutEvent);
        },
    });

    sdkInitialised = true;
}

/**
 * Create a checkout session via the Supabase edge function and redirect to
 * Dodo Payments checkout page.
 */
export async function openPremiumCheckout(opts?: {
    customerEmail?: string;
    customerName?: string;
    customerId?: string;
    billingCycle?: BillingCycle;
    onEvent?: CheckoutEventCallback;
}): Promise<void> {
    const { customerEmail, customerName, customerId, billingCycle = 'annual', onEvent } = opts ?? {};

    initDodoPayments(onEvent);

    const productId = billingCycle === 'annual' ? ANNUAL_DODO_PRODUCT_ID : MONTHLY_DODO_PRODUCT_ID;

    if (!productId) {
        throw new Error(
            billingCycle === 'annual'
                ? 'VITE_DODO_ANNUAL_PRODUCT_ID is not set. Create the annual subscription product in your Dodo Payments dashboard and add the product ID to your .env file.'
                : 'VITE_DODO_PRODUCT_ID is not set. Create a subscription product in your Dodo Payments dashboard and add the product ID to your .env file.',
        );
    }

    // Call our edge function to create a checkout session
    const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
            product_id: productId,
            customer_email: customerEmail,
            customer_name: customerName,
            customer_id: customerId,
            success_url: `${window.location.origin}/dashboard?payment=success`,
            failure_url: `${window.location.origin}/dashboard?payment=failed`,
        },
    });

    if (error || !data?.checkout_url) {
        console.error('Failed to create checkout session. Error object:', error);
        console.error('Response data:', data);
        
        let errorMessage = 'Could not create checkout session.';
        if (data?.details) {
            errorMessage += `\nDodo API Error: ${data.details}`;
        } else if (data?.error) {
            errorMessage += `\nError: ${data.error}`;
        } else if (error?.message) {
            errorMessage += `\nError: ${error.message}`;
        }

        throw new Error(errorMessage);
    }

    // Open the hosted Dodo Payments checkout in an overlay.
    await DodoPayments.Checkout.open({
        checkoutUrl: data.checkout_url,
    });

    makeDodoOverlayTransparent();
}
