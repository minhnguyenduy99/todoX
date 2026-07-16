import { z } from 'zod';

export const mcpEnvSchema = z.object({
  BACKEND_URL: z.string().url().default('http://localhost:3000'),
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('stdio'),
  MCP_PORT: z.coerce.number().default(3001),
});

export type McpEnv = z.infer<typeof mcpEnvSchema>;

export function validateMcpEnv(): McpEnv {
  const result = mcpEnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`MCP environment validation failed: ${formatted}`);
  }
  return result.data;
}
