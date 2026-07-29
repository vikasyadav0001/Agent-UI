import { Scalekit } from '@scalekit-sdk/node'

export const scalekit = new Scalekit (
    process.env.SCALEKIT_ENV_URL!,
    process.env.SCALEKIT_CLIENT_ID!,
    process.env.SCALEKIT_CLIENT_SECRET!,
);

