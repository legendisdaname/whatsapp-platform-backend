const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatsApp Platform API',
      version: '1.0.0',
      description: 'WhatsApp Platform API with whatsapp-web.js and Supabase',
      contact: {
        name: 'API Support'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'https://whatapi.streamfinitytv.com',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            session_name: { type: 'string' },
            phone_number: { type: 'string' },
            status: { type: 'string', enum: ['disconnected', 'connecting', 'connected', 'qr'] },
            qr_code: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Message: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            session_id: { type: 'string', format: 'uuid' },
            to: { type: 'string' },
            message: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'sent', 'failed'] },
            scheduled_at: { type: 'string', format: 'date-time', nullable: true },
            sent_at: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Bot: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            session_id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            is_active: { type: 'boolean' },
            schedule_pattern: { type: 'string' },
            target_numbers: { type: 'array', items: { type: 'string' } },
            message_template: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;

