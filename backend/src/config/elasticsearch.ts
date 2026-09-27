import { Client } from '@elastic/elasticsearch';
import { env } from './env';

const nodeUrl = env.ELASTICSEARCH_URL || env.ELASTICSEARCH_NODE || 'http://localhost:9200';

export const esClient = new Client({
  node: nodeUrl,
  auth:
    env.ELASTICSEARCH_USERNAME && env.ELASTICSEARCH_PASSWORD
      ? {
          username: env.ELASTICSEARCH_USERNAME,
          password: env.ELASTICSEARCH_PASSWORD,
        }
      : undefined,
  maxRetries: 2,
  requestTimeout: 4000,
});

export async function checkElasticsearchConnection(): Promise<boolean> {
  try {
    const health = await esClient.cluster.health({});
    return health.status === 'green' || health.status === 'yellow';
  } catch (err: any) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('⚠️ Elasticsearch connection unavailable:', err.message);
    }
    return false;
  }
}
