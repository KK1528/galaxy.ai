import { defineConfig } from '@trigger.dev/sdk'
import { prismaExtension } from '@trigger.dev/build/extensions/prisma'

export default defineConfig({
  // Replace with your project ref from https://cloud.trigger.dev → Settings → Project
  project: process.env.TRIGGER_PROJECT_REF ?? 'proj_qflpsolrzmwddbvtkegi',

  dirs: ['./src/trigger'],

  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },

  // Allow long-running tasks (Crop Image has mandatory 30s delay)
  maxDuration: 300,

  build: {
    extensions: [
      prismaExtension({
        mode: 'legacy',
        schema: 'prisma/schema.prisma',
      }),
    ],
  },
})
