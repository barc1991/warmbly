// One view of the Warmbly Cloud pool link for the dashboard: whether this is
// a self-hosted instance, whether it is linked, and which mailboxes the cloud
// warms. Queries stay disabled on the hosted product.


export default function useCloudPool() {
    return {
        selfHosted: true,
        connected: false,
        reachable: false,
        orgName: "",
        plan: undefined,
        enrolledCount: 0,
        rowFor: (_id: string) => undefined,
        isEnrolled: (_id: string) => false,
        loading: false,
    };
}

