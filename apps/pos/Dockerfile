FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/types/package.json ./packages/types/
COPY packages/ui/package.json ./packages/ui/
COPY apps/pos/package.json ./apps/pos/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/apps/pos/node_modules ./apps/pos/node_modules

ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_ROOT_URL=https://gosenku.com
ARG NEXT_PUBLIC_CLERK_DOMAIN
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=https://gosenku.com/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=https://gosenku.com/sign-up

ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_ROOT_URL=$NEXT_PUBLIC_ROOT_URL
ENV NEXT_PUBLIC_CLERK_DOMAIN=$NEXT_PUBLIC_CLERK_DOMAIN
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL

COPY . .
RUN pnpm --filter @senku/pos build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/pos/.next/standalone ./
COPY --from=builder /app/apps/pos/.next/static ./apps/pos/.next/static
COPY --from=builder /app/apps/pos/public ./apps/pos/public

EXPOSE 8080
CMD ["node", "apps/pos/server.js"]
