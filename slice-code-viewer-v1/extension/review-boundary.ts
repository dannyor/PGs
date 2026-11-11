import type { ReviewDescriptor, RpcRequest, RpcResponse } from "../protocol/types.js";
import { DescriptorValidationError, parseReviewDescriptor } from "../protocol/validation.js";

export interface ReviewLoader {
  currentReviewId(): string | undefined;
  load(descriptor: ReviewDescriptor): Promise<void>;
}

export interface ReviewBoundaryContext {
  workspaceId: string;
  loader: ReviewLoader;
}

export async function handleReviewRequest(
  request: RpcRequest,
  context: ReviewBoundaryContext
): Promise<RpcResponse | undefined> {
  if (request.method !== "review.load") return undefined;

  try {
    const descriptor = parseReviewDescriptor(request.params, context.workspaceId);
    const replacedReviewId = context.loader.currentReviewId();
    await context.loader.load(descriptor);
    return {
      kind: "response",
      id: request.id,
      result: {
        reviewId: descriptor.id,
        itemCount: descriptor.items.length,
        ...(replacedReviewId === undefined ? {} : { replacedReviewId })
      }
    };
  } catch (error) {
    if (error instanceof DescriptorValidationError) {
      return {
        kind: "response",
        id: request.id,
        error: { code: "invalid-descriptor", message: error.message }
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { kind: "response", id: request.id, error: { code: "internal-error", message } };
  }
}
