import { default as fetch } from 'node-fetch';
// import jwt from 'jsonwebtoken'; //needed for JWT token generation
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema, ListToolsRequestSchema, CallToolRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
// import { Template, Clause } from '@accordproject/cicero-core';
// Create server instance
const server = new Server({
    name: "accord",
    version: "1.0.1",
}, {
    capabilities: {
        resources: {},
        tools: {},
        prompts: {
            description: "Smart legal contracts and agreements",
            messages: [
                {
                    role: "user",
                    content: "List all available templates"
                },
                {
                    role: "assistant",
                    content: "I'll help you list the available templates. Let me check what's available."
                }
            ]
        }
    }
});
// Configuration
const APAP_BASE_URL = process.env.APAP_BASE_URL || 'http://127.0.0.1:3000';
console.error(`Using APAP base URL: ${APAP_BASE_URL}`);
// Module-level debugging
console.error('=== APAP Module Loading Start ===');
console.error('Loading APAP module...');
/**
 * Base class for APAP client classes that handles authentication.
 */
export class APAPBase {
    apapBaseUrl;
    token = null;
    tokenExpiry = null;
    constructor(baseUrl = 'http://127.0.0.1:3000') {
        console.error('=== APAPBase Constructor Start ===');
        console.error(`Initializing with base URL: ${baseUrl}`);
        this.apapBaseUrl = baseUrl;
        // TODO Generate a JWT token for authentication if needed
        this.token = process.env.JWT_TOKEN || null;
        this.tokenExpiry = this.token ? Date.now() + (60 * 60 * 1000) : null; // 1 hour expiry if token exists
        console.error('JWT token generated:', {
            hasToken: !!this.token,
            expiryTime: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'none'
        });
        console.error('=== APAPBase Constructor Complete ===');
    }
    /**
     * Authenticate with the server using username and password.
     * Returns true if authentication was successful.
     */
    async authenticate(username, password) {
        console.error('=== Authentication Start ===');
        console.error(`Attempting to authenticate with username: ${username}`);
        try {
            console.error(`Making auth request to: ${this.apapBaseUrl}/auth`);
            const startTime = Date.now();
            const response = await fetch(`${this.apapBaseUrl}/auth`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const endTime = Date.now();
            console.error(`Auth request completed in ${endTime - startTime}ms`);
            console.error(`Auth response status: ${response.status}`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Authentication failed with status: ${response.status}`);
                console.error(`Error response: ${errorText}`);
                console.error('=== Authentication Failed (Bad Response) ===');
                return false;
            }
            const authResponse = await response.json();
            console.error('Auth response received:', {
                hasToken: !!authResponse.token,
                expiresIn: authResponse.expiresIn,
                tokenLength: authResponse.token?.length
            });
            this.token = authResponse.token;
            this.tokenExpiry = Date.now() + (authResponse.expiresIn * 1000);
            console.error('Token saved:', {
                hasToken: !!this.token,
                expiryTime: new Date(this.tokenExpiry).toISOString(),
                tokenLength: this.token?.length
            });
            console.error('=== Authentication Success ===');
            return true;
        }
        catch (error) {
            console.error('Authentication error:', error);
            console.error('=== Authentication Failed (Error) ===');
            return false;
        }
    }
    /**
     * Check if the current token is valid and not expired.
     */
    isTokenValid() {
        console.error('=== Token Validation Check Start ===');
        const now = Date.now();
        const isValid = this.token !== null &&
            this.tokenExpiry !== null &&
            now < this.tokenExpiry;
        console.error('Token validation details:', {
            hasToken: !!this.token,
            hasExpiry: !!this.tokenExpiry,
            currentTime: new Date(now).toISOString(),
            expiryTime: this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'none',
            isExpired: this.tokenExpiry ? now >= this.tokenExpiry : true,
            isValid
        });
        console.error('=== Token Validation Check Complete ===');
        return isValid;
    }
    /**
     * Get the current authentication token.
     * Returns null if no valid token exists.
     */
    getAuthHeaders() {
        if (!this.token) {
            return {};
        }
        return { 'Authorization': `Bearer ${this.token}` };
    }
}
// Set up resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    // First, fetch the actual templates and agreements to get their IDs
    const token = new APAPBase(APAP_BASE_URL).token;
    try {
        // Fetch templates
        const templatesResponse = await fetch(`${APAP_BASE_URL}/templates`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const templates = await templatesResponse.json();
        // Fetch agreements
        const agreementsResponse = await fetch(`${APAP_BASE_URL}/agreements`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const agreements = await agreementsResponse.json();
        // Construct resources with actual IDs
        const resources = [
            {
                uri: "template://list",
                name: "List Templates",
                description: "List all available templates"
            },
            {
                uri: "agreement://list",
                name: "List Agreements",
                description: "List all available agreements"
            },
            // Add resources for each template
            ...templates.map((t) => ({
                uri: `template://${t}`,
                name: `Template ${t}`,
                description: `Template ${t}`
            })),
            // Add resources for each agreement
            ...agreements.map((a) => ({
                uri: `agreement://${a.replace(/"/g, '')}`,
                name: `Agreement ${a}`,
                description: `Agreement ${a}`
            }))
        ];
        return { resources };
    }
    catch (error) {
        console.error('Error listing resources:', error);
        throw error;
    }
});
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const token = new APAPBase(APAP_BASE_URL).token;
    try {
        if (uri === "template://list") {
            const url = `${APAP_BASE_URL}/templates`;
            const headers = { 'Authorization': `Bearer ${token}` };
            console.error('=== Making Template List Request ===');
            console.error('Request URL:', url);
            console.error('Request Headers:', JSON.stringify(headers, null, 2));
            console.error('Request Method: GET');
            const response = await fetch(url, {
                headers: headers,
                method: 'GET'
            });
            console.error('Response Status:', response.status);
            console.error('Response Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Response Error Text:', errorText);
                throw new Error(`Failed to fetch templates: ${response.status} ${response.statusText}`);
            }
            const templates = await response.json();
            console.error('Response Body:', JSON.stringify(templates, null, 2));
            return {
                contents: templates.map((t) => ({
                    uri: `template://${t}`,
                    text: t
                }))
            };
        }
        if (uri === "agreement://list") {
            console.error(`Fetching agreements from ${APAP_BASE_URL}/agreements`);
            const response = await fetch(`${APAP_BASE_URL}/agreements`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch agreements: ${response.status} ${response.statusText}`);
            }
            const agreements = await response.json();
            return {
                contents: agreements.map((a) => ({
                    uri: `agreement://${a.replace(/"/g, '')}`,
                    text: a
                }))
            };
        }
        // Handle fetching a specific template
        const templateMatch = uri.match(/^template:\/\/([^/]+)$/);
        if (templateMatch) {
            const templateId = templateMatch[1];
            const response = await fetch(`${APAP_BASE_URL}/templates/${templateId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch template ${templateId}: ${response.status} ${response.statusText}`);
            }
            const template = await response.json();
            // Extract and format the template data
            const formattedTemplate = {
                text: template.text || '',
                name: template.name || templateId,
                author: template.author || 'Unknown'
            };
            return {
                contents: [{
                        uri: uri,
                        text: JSON.stringify(formattedTemplate)
                    }]
            };
        }
        // Handle fetching a specific agreement
        const agreementMatch = uri.match(/^agreement:\/\/([^/]+)$/);
        if (agreementMatch) {
            const agreementId = agreementMatch[1];
            const response = await fetch(`${APAP_BASE_URL}/agreements/${agreementId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch agreement ${agreementId}: ${response.status} ${response.statusText}`);
            }
            const agreement = await response.json();
            // Extract just the data and state fields
            const simplifiedAgreement = {
                data: agreement.data,
                state: agreement.state
            };
            return {
                contents: [{
                        uri: uri,
                        text: JSON.stringify(simplifiedAgreement)
                    }]
            };
        }
        if (uri.startsWith("agreement://") && uri.endsWith("/state")) {
            const agreementId = uri.split('/')[1];
            console.error(`Fetching state for agreement ${agreementId} from ${APAP_BASE_URL}/agreements/${agreementId}/state`);
            const response = await fetch(`${APAP_BASE_URL}/agreements/${agreementId}/state`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch state for agreement ${agreementId}: ${response.status} ${response.statusText}`);
            }
            const state = await response.json();
            return {
                contents: [{
                        uri: uri,
                        text: JSON.stringify(state)
                    }]
            };
        }
        throw new Error(`Unknown resource URI: ${uri}`);
    }
    catch (error) {
        console.error('=== Request Error Details ===');
        console.error('Error Type:', error instanceof Error ? error.constructor.name : typeof error);
        console.error('Error Message:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.error('Error Stack:', error.stack);
        }
        if (error instanceof Error) {
            if (error.message.includes('ECONNREFUSED')) {
                throw new Error(`Could not connect to APAP server at ${APAP_BASE_URL}. Please ensure the server is running and accessible.`);
            }
            throw new Error(`Failed to handle resource request: ${error.message}`);
        }
        throw error;
    }
});
// Set up tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "getTemplate",
                description: "Get a specific template by ID",
                inputSchema: {
                    type: "object",
                    properties: {
                        templateId: {
                            type: "string",
                            description: "ID of the template to retrieve"
                        }
                    },
                    required: ["templateId"]
                }
            },
            {
                name: "getAgreement",
                description: "Get a specific agreement by ID",
                inputSchema: {
                    type: "object",
                    properties: {
                        agreementId: {
                            type: "string",
                            description: "ID of the agreement to retrieve"
                        }
                    },
                    required: ["agreementId"]
                }
            },
            {
                name: "createAgreement",
                description: "Create a new agreement",
                inputSchema: {
                    type: "object",
                    properties: {
                        templateId: {
                            type: "string",
                            description: "ID of the template to use"
                        },
                        data: {
                            type: "object",
                            description: "Data for the agreement including parties, signatures, and metadata"
                        },
                        agreementParties: {
                            type: "array",
                            description: "Array of agreement parties",
                            items: {
                                type: "object",
                                properties: {
                                    partyId: { type: "string" },
                                    name: { type: "string" },
                                    email: { type: "string" }
                                }
                            }
                        },
                        signatures: {
                            type: "array",
                            description: "Array of signatures",
                            items: {
                                type: "object",
                                properties: {
                                    partyId: { type: "string" },
                                    timestamp: { type: "string" },
                                    signature: { type: "string" }
                                }
                            }
                        },
                        metadata: {
                            type: "object",
                            description: "Agreement metadata",
                            properties: {
                                version: { type: "string" },
                                effectiveDate: { type: "string" },
                                expirationDate: { type: "string" }
                            }
                        }
                    },
                    required: ["templateId", "data", "agreementParties"]
                }
            },
            {
                name: "trigger",
                description: "Trigger a clause in an agreement",
                inputSchema: {
                    type: "object",
                    properties: {
                        agreementId: {
                            type: "string",
                            description: "ID of the agreement"
                        },
                        request: {
                            type: "object",
                            description: "Request data for the trigger"
                        }
                    },
                    required: ["agreementId", "request"]
                }
            },
            {
                name: "createTemplate",
                description: "Create a new template",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Name of the template"
                        },
                        displayName: {
                            type: "string",
                            description: "Display name of the template"
                        },
                        description: {
                            type: "string",
                            description: "Description of the template"
                        },
                        author: {
                            type: "string",
                            description: "Author of the template"
                        },
                        version: {
                            type: "string",
                            description: "Version of the template"
                        },
                        license: {
                            type: "string",
                            description: "License of the template"
                        },
                        keywords: {
                            type: "array",
                            description: "Keywords for the template",
                            items: { type: "string" }
                        },
                        templateModel: {
                            type: "object",
                            description: "Template model definition",
                            properties: {
                                typeName: {
                                    type: "string",
                                    description: "Type name of the contract model"
                                },
                                model: {
                                    type: "object",
                                    description: "Concerto model definition",
                                    properties: {
                                        namespace: { type: "string" },
                                        concertoVersion: { type: "string" },
                                        imports: { type: "array", items: { type: "string" } },
                                        declarations: { type: "array" }
                                    }
                                }
                            }
                        },
                        text: {
                            type: "object",
                            description: "Template text in Cicero format",
                            properties: {
                                templateMark: { type: "string" }
                            }
                        },
                        logic: {
                            type: "object",
                            description: "Template logic definition",
                            properties: {
                                functions: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            requestType: { type: "string" },
                                            responseType: { type: "string" },
                                            code: {
                                                type: "object",
                                                properties: {
                                                    type: { type: "string" },
                                                    encoding: { type: "string" },
                                                    value: { type: "string" }
                                                }
                                            }
                                        }
                                    }
                                },
                                stateType: { type: "string" }
                            }
                        }
                    },
                    required: ["name", "displayName", "description", "author", "version", "license", "templateModel", "text"]
                }
            }
        ]
    };
});
// Add keep-alive mechanism with less frequent logging
const keepAlive = setInterval(() => {
    // Only log if there's been activity in the last minute
    const now = Date.now();
    if (now - lastActivityTime < 60000) {
        console.error('=== APAP Keep-Alive Heartbeat ===');
    }
}, 60000); // Log every 60 seconds
let lastActivityTime = Date.now();
// Update lastActivityTime whenever there's activity
const updateActivityTime = () => {
    lastActivityTime = Date.now();
};
// Handle graceful shutdown
const shutdown = async () => {
    console.error('=== APAP Module Shutdown Start ===');
    clearInterval(keepAlive);
    console.error('Keep-alive interval cleared');
    console.error('=== APAP Module Shutdown Complete ===');
    // Don't force exit, let the process end naturally
};
process.on('SIGINT', () => {
    console.error('Received SIGINT, initiating graceful shutdown...');
    shutdown();
});
process.on('SIGTERM', () => {
    console.error('Received SIGTERM, initiating graceful shutdown...');
    shutdown();
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    // Don't shutdown on uncaught exceptions, just log them
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
    // Don't shutdown on unhandled rejections, just log them
});
// Update fetch options with longer timeout and keep-alive
const fetchOptions = {
    timeout: 120000, // 120 second timeout
    headers: {
        'Authorization': `Bearer ${new APAPBase().token}`,
        'Connection': 'keep-alive'
    }
};
// Update tool handlers to use fetchOptions and track activity
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    updateActivityTime();
    const baseUrl = 'http://127.0.0.1:3000';
    const { name, arguments: args } = request.params;
    if (name === "getTemplate") {
        if (!args || typeof args !== 'object') {
            throw new Error('Invalid arguments for getTemplate');
        }
        const { templateId } = args;
        const response = await fetch(`${baseUrl}/templates/${templateId}`, fetchOptions);
        if (!response.ok) {
            throw new Error(`Failed to get template ${templateId}`);
        }
        const template = await response.json();
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(template)
                }]
        };
    }
    if (name === "getAgreement") {
        if (!args || typeof args !== 'object') {
            throw new Error('Invalid arguments for getAgreement');
        }
        const { agreementId } = args;
        const response = await fetch(`${baseUrl}/agreements/${agreementId}`, fetchOptions);
        if (!response.ok) {
            throw new Error(`Failed to get agreement ${agreementId}`);
        }
        const agreement = await response.json();
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(agreement)
                }]
        };
    }
    if (name === "createAgreement") {
        if (!args || typeof args !== 'object') {
            throw new Error('Invalid arguments for createAgreement');
        }
        const { templateId, data, agreementParties, signatures, metadata } = args;
        // Construct the full agreement object
        const agreement = {
            $class: "org.accordproject.protocol@1.0.0.Agreement",
            template: templateId,
            data: JSON.stringify(data),
            agreementParties: agreementParties.map(party => ({
                $class: "org.accordproject.protocol@1.0.0.AgreementParty",
                ...party
            })),
            signatures: (signatures || []).map(signature => ({
                $class: "org.accordproject.protocol@1.0.0.Signature",
                ...signature
            })),
            agreementStatus: "DRAFT",
            historyEntries: [],
            attachments: [],
            references: [],
            metadata: metadata ? {
                $class: "org.accordproject.protocol@1.0.0.Metadata",
                ...metadata
            } : undefined
        };
        console.error('Creating agreement with data:', JSON.stringify(agreement, null, 2));
        const response = await fetch(`${baseUrl}/agreements`, {
            ...fetchOptions,
            method: 'POST',
            headers: {
                ...fetchOptions.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(agreement)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to create agreement: ${errorText}`);
            throw new Error(`Failed to create agreement from template ${templateId}: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        console.error('Agreement created successfully:', JSON.stringify(result, null, 2));
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result)
                }]
        };
    }
    if (name === "trigger") {
        if (!args || typeof args !== 'object') {
            throw new Error('Invalid arguments for trigger');
        }
        const { agreementId, request: triggerRequest } = args;
        console.error(`Triggering agreement ${agreementId} with request:`, JSON.stringify(triggerRequest, null, 2));
        const response = await fetch(`${baseUrl}/agreements/${agreementId}/trigger`, {
            ...fetchOptions,
            method: 'POST',
            headers: {
                ...fetchOptions.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(triggerRequest)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to trigger agreement ${agreementId}:`, errorText);
            throw new Error(`Failed to trigger agreement ${agreementId}: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        console.error(`Trigger result for agreement ${agreementId}:`, JSON.stringify(result, null, 2));
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result)
                }]
        };
    }
    if (name === "createTemplate") {
        if (!args || typeof args !== 'object') {
            throw new Error('Invalid arguments for createTemplate');
        }
        const { name, displayName, description, author, version, license, keywords, templateModel, text, logic } = args;
        // Construct the template object
        const template = {
            $class: "org.accordproject.protocol@1.0.0.Template",
            name,
            displayName,
            description,
            author,
            version,
            license,
            keywords: keywords || [],
            templateModel: {
                $class: "org.accordproject.protocol@1.0.0.TemplateModel",
                ...templateModel
            },
            text: {
                $class: "org.accordproject.protocol@1.0.0.Text",
                ...text
            },
            logic: logic ? {
                $class: "org.accordproject.protocol@1.0.0.Logic",
                ...logic
            } : undefined
        };
        console.error('Creating template with data:', JSON.stringify(template, null, 2));
        const response = await fetch(`${baseUrl}/templates`, {
            ...fetchOptions,
            method: 'POST',
            headers: {
                ...fetchOptions.headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(template)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to create template: ${errorText}`);
            throw new Error(`Failed to create template: ${response.status} ${response.statusText}`);
        }
        const result = await response.json();
        console.error('Template created successfully:', JSON.stringify(result, null, 2));
        return {
            content: [{
                    type: "text",
                    text: JSON.stringify(result)
                }]
        };
    }
    throw new Error(`Unknown tool: ${name}`);
});
// Set up prompts handler
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: "List Templates",
                description: "List all available templates",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: "List all available templates"
                        }
                    },
                    {
                        role: "assistant",
                        content: {
                            type: "text",
                            text: "I'll help you list the available templates. Let me check what's available by accessing the template://list resource."
                        }
                    }
                ]
            },
            {
                name: "View Template",
                description: "View a specific template's details",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: "Show me the details of the 'acceptance-of-delivery' template"
                        }
                    },
                    {
                        role: "assistant",
                        content: {
                            type: "text",
                            text: "I'll use the getTemplate tool to fetch the details. Here's the exact tool call I'll make:\n\n```json\n{\n  \"name\": \"getTemplate\",\n  \"arguments\": {\n    \"templateId\": \"acceptance-of-delivery\"\n  }\n}\n```\n\nThis will return the template's text, name, and author."
                        }
                    }
                ]
            },
            {
                name: "List Agreements",
                description: "List all available agreements",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: "List all available agreements"
                        }
                    },
                    {
                        role: "assistant",
                        content: {
                            type: "text",
                            text: "I'll help you list the available agreements by accessing the agreement://list resource."
                        }
                    }
                ]
            },
            {
                name: "View Agreement",
                description: "View a specific agreement's details",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: "Show me the details of agreement 'd0bf9cb6-97d1-4778-b21b-7525ad95f36a'"
                        }
                    },
                    {
                        role: "assistant",
                        content: {
                            type: "text",
                            text: "I'll use the getAgreement tool to fetch the details. Here's the exact tool call I'll make:\n\n```json\n{\n  \"name\": \"getAgreement\",\n  \"arguments\": {\n    \"agreementId\": \"d0bf9cb6-97d1-4778-b21b-7525ad95f36a\"\n  }\n}\n```\n\nThis will return the agreement's template ID, data, and current state."
                        }
                    }
                ]
            },
            {
                name: "Create Agreement",
                description: "Create a new agreement using a template",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: "Create a new agreement using the 'acceptance-of-delivery' template"
                        }
                    },
                    {
                        role: "assistant",
                        content: {
                            type: "text",
                            text: "I'll help you create a new agreement. First, I'll get the template details using the getTemplate tool:\n\n```json\n{\n  \"name\": \"getTemplate\",\n  \"arguments\": {\n    \"templateId\": \"acceptance-of-delivery\"\n  }\n}\n```\n\nThen, I'll use the createAgreement tool with the template ID and required data. Here's an example of the full data structure needed:\n\n```json\n{\n  \"name\": \"createAgreement\",\n  \"arguments\": {\n    \"templateId\": \"acceptance-of-delivery\",\n    \"data\": {\n      \"deliveryDate\": \"2024-03-20\",\n      \"deliveryLocation\": \"123 Main St\"\n    },\n    \"agreementParties\": [\n      {\n        \"partyId\": \"buyer-1\",\n        \"name\": \"John Doe\",\n        \"email\": \"john@example.com\"\n      },\n      {\n        \"partyId\": \"seller-1\",\n        \"name\": \"Jane Smith\",\n        \"email\": \"jane@example.com\"\n      }\n    ],\n    \"signatures\": [],\n    \"metadata\": {\n      \"version\": \"1.0.0\",\n      \"effectiveDate\": \"2024-03-20\",\n      \"expirationDate\": \"2025-03-20\"\n    }\n  }\n}\n```"
                        }
                    }
                ]
            },
            {
                name: "Trigger Clause",
                description: "Trigger a specific clause in an agreement",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: "Trigger the 'onDelivery' clause in agreement 'd0bf9cb6-97d1-4778-b21b-7525ad95f36a'"
                        }
                    },
                    {
                        role: "assistant",
                        content: {
                            type: "text",
                            text: "I'll help you trigger the onDelivery clause. First, I'll get the agreement details using the getAgreement tool:\n\n```json\n{\n  \"name\": \"getAgreement\",\n  \"arguments\": {\n    \"agreementId\": \"d0bf9cb6-97d1-4778-b21b-7525ad95f36a\"\n  }\n}\n```\n\nThen, I'll use the trigger tool with the agreement ID and request data:\n\n```json\n{\n  \"name\": \"trigger\",\n  \"arguments\": {\n    \"agreementId\": \"d0bf9cb6-97d1-4778-b21b-7525ad95f36a\",\n    \"request\": {\n      \"clause\": \"onDelivery\",\n      \"data\": {\n        \"deliveryDate\": \"2024-03-20\",\n        \"deliveryLocation\": \"123 Main St\"\n      }\n    }\n  }\n}\n```"
                        }
                    }
                ]
            },
            {
                name: "Create Template",
                description: "Create a new template",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: "Create a new template called 'hello-world'"
                        }
                    },
                    {
                        role: "assistant",
                        content: {
                            type: "text",
                            text: "I'll help you create a new template. Here's an example of how to use the createTemplate tool:\n\n```json\n{\n  \"name\": \"createTemplate\",\n  \"arguments\": {\n    \"name\": \"hello-world\",\n    \"text\": \"Hello {{name}}! Welcome to the world of smart legal contracts.\",\n    \"author\": \"Your Name\",\n    \"version\": \"1.0.0\"\n  }\n}\n```\n\nThis will create a new template with the specified name, text, author, and version."
                        }
                    }
                ]
            }
        ]
    };
});
// Set up prompt read handler
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    // Define prompts with proper typing
    const prompts = {
        "List Templates": {
            name: "List Templates",
            description: "List all available templates",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "List all available templates"
                    }
                },
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: "I'll help you list the available templates. Let me check what's available by accessing the template://list resource."
                    }
                }
            ]
        },
        "View Template": {
            name: "View Template",
            description: "View a specific template's details",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "Show me the details of the 'acceptance-of-delivery' template"
                    }
                },
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: "I'll use the getTemplate tool to fetch the details. Here's the exact tool call I'll make:\n\n```json\n{\n  \"name\": \"getTemplate\",\n  \"arguments\": {\n    \"templateId\": \"acceptance-of-delivery\"\n  }\n}\n```\n\nThis will return the template's text, name, and author."
                    }
                }
            ]
        },
        "List Agreements": {
            name: "List Agreements",
            description: "List all available agreements",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "List all available agreements"
                    }
                },
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: "I'll help you list the available agreements by accessing the agreement://list resource."
                    }
                }
            ]
        },
        "View Agreement": {
            name: "View Agreement",
            description: "View a specific agreement's details",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "Show me the details of agreement 'd0bf9cb6-97d1-4778-b21b-7525ad95f36a'"
                    }
                },
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: "I'll use the getAgreement tool to fetch the details. Here's the exact tool call I'll make:\n\n```json\n{\n  \"name\": \"getAgreement\",\n  \"arguments\": {\n    \"agreementId\": \"d0bf9cb6-97d1-4778-b21b-7525ad95f36a\"\n  }\n}\n```\n\nThis will return the agreement's template ID, data, and current state."
                    }
                }
            ]
        },
        "Create Agreement": {
            name: "Create Agreement",
            description: "Create a new agreement using a template",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "Create a new agreement using the 'acceptance-of-delivery' template"
                    }
                },
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: "I'll help you create a new agreement. First, I'll get the template details using the getTemplate tool:\n\n```json\n{\n  \"name\": \"getTemplate\",\n  \"arguments\": {\n    \"templateId\": \"acceptance-of-delivery\"\n  }\n}\n```\n\nThen, I'll use the createAgreement tool with the template ID and required data. Here's an example of the full data structure needed:\n\n```json\n{\n  \"name\": \"createAgreement\",\n  \"arguments\": {\n    \"templateId\": \"acceptance-of-delivery\",\n    \"data\": {\n      \"deliveryDate\": \"2024-03-20\",\n      \"deliveryLocation\": \"123 Main St\"\n    },\n    \"agreementParties\": [\n      {\n        \"partyId\": \"buyer-1\",\n        \"name\": \"John Doe\",\n        \"email\": \"john@example.com\"\n      },\n      {\n        \"partyId\": \"seller-1\",\n        \"name\": \"Jane Smith\",\n        \"email\": \"jane@example.com\"\n      }\n    ],\n    \"signatures\": [],\n    \"metadata\": {\n      \"version\": \"1.0.0\",\n      \"effectiveDate\": \"2024-03-20\",\n      \"expirationDate\": \"2025-03-20\"\n    }\n  }\n}\n```"
                    }
                }
            ]
        },
        "Trigger Clause": {
            name: "Trigger Clause",
            description: "Trigger a specific clause in an agreement",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "Trigger the 'onDelivery' clause in agreement 'd0bf9cb6-97d1-4778-b21b-7525ad95f36a'"
                    }
                },
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: "I'll help you trigger the onDelivery clause. First, I'll get the agreement details using the getAgreement tool:\n\n```json\n{\n  \"name\": \"getAgreement\",\n  \"arguments\": {\n    \"agreementId\": \"d0bf9cb6-97d1-4778-b21b-7525ad95f36a\"\n  }\n}\n```\n\nThen, I'll use the trigger tool with the agreement ID and request data:\n\n```json\n{\n  \"name\": \"trigger\",\n  \"arguments\": {\n    \"agreementId\": \"d0bf9cb6-97d1-4778-b21b-7525ad95f36a\",\n    \"request\": {\n      \"clause\": \"onDelivery\",\n      \"data\": {\n        \"deliveryDate\": \"2024-03-20\",\n        \"deliveryLocation\": \"123 Main St\"\n      }\n    }\n  }\n}\n```"
                    }
                }
            ]
        },
        "Create Template": {
            name: "Create Template",
            description: "Create a new template",
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "Create a new template called 'hello-world'"
                    }
                },
                {
                    role: "assistant",
                    content: {
                        type: "text",
                        text: "I'll help you create a new template. Here's an example of how to use the createTemplate tool:\n\n```json\n{\n  \"name\": \"createTemplate\",\n  \"arguments\": {\n    \"name\": \"hello-world\",\n    \"text\": \"Hello {{name}}! Welcome to the world of smart legal contracts.\",\n    \"author\": \"Your Name\",\n    \"version\": \"1.0.0\"\n  }\n}\n```\n\nThis will create a new template with the specified name, text, author, and version."
                    }
                }
            ]
        }
    };
    const prompt = prompts[promptName];
    if (!prompt) {
        throw new Error(`Unknown prompt: ${promptName}`);
    }
    return {
        messages: prompt.messages
    };
});
// Module-level instantiation
console.error('=== APAP Module Instantiation Start ===');
console.error('Creating APAP instances...');
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    try {
        await server.connect(transport);
        console.error("APAP MCP Server running on stdio");
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
console.error('=== APAP Module Instantiation Complete ===');
console.error('=== APAP Module Loading Complete ===');
// Export the server
export { server };
