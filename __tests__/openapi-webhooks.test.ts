/**
 * OpenAPI examples coverage for /api/webhooks (issue #1115).
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';

function loadOpenApiYaml(): any {
  const raw = readFileSync(join(__dirname, '..', 'src', 'openapi.yaml'), 'utf8');
  return yaml.load(raw);
}

describe('OpenAPI examples /api/webhooks', () => {
  const spec = loadOpenApiYaml();

  it('declares /api/webhooks with GET and POST', () => {
    const path = spec.paths['/api/webhooks'];
    expect(path).toBeDefined();
    expect(path.get).toBeDefined();
    expect(path.post).toBeDefined();
  });

  it('GET 200 includes Prometheus metricsSample example', () => {
    const examples =
      spec.paths['/api/webhooks'].get.responses['200'].content['text/plain']
        .examples;
    expect(examples.metricsSample.value).toContain('webhook_requests_total');
  });

  it('POST requestBody and 200 success examples are present', () => {
    const post = spec.paths['/api/webhooks'].post;
    expect(
      post.requestBody.content['application/json'].examples.paymentReceived
        .value.eventType,
    ).toBe('payment.received');
    expect(
      post.responses['200'].content['application/json'].examples.accepted.value,
    ).toEqual({ success: true });
  });

  it('POST 400 example uses INVALID_INPUT envelope', () => {
    const example =
      spec.paths['/api/webhooks'].post.responses['400'].content[
        'application/json'
      ].examples.missingEventType.value;
    expect(example.error.code).toBe('INVALID_INPUT');
    expect(example.error.request_id).toMatch(/^req_/);
  });

  it('declares /api/webhooks/dlq POST examples', () => {
    const dlq = spec.paths['/api/webhooks/dlq'].post;
    expect(
      dlq.requestBody.content['application/json'].examples.deadLetter,
    ).toBeDefined();
    expect(
      dlq.responses['200'].content['application/json'].examples.received.value,
    ).toEqual({ received: true });
  });

  it('declares /api/webhooks/deliveries GET examples', () => {
    const deliveries = spec.paths['/api/webhooks/deliveries'].get;
    const example =
      deliveries.responses['200'].content['application/json'].examples
        .deliveriesList.value;
    expect(example).toEqual(
      expect.objectContaining({
        deliveries: expect.any(Array),
        cursor: null,
        limit: 20,
      }),
    );
  });
});
