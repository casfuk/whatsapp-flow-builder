import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { safeJson } from "@/lib/safe-response";

/**
 * GET /api/integrations/facebook/lead-forms
 * Fetches lead forms from Facebook for the connected page
 */
export async function GET(request: NextRequest) {
  try {
    // Get the connected page integration
    const integration = await prisma.facebookPageIntegration.findFirst();

    if (!integration) {
      return safeJson(
        { error: "No Facebook page connected" },
        { status: 404 }
      );
    }

    // Fetch lead forms from Facebook Graph API
    const url = `https://graph.facebook.com/v21.0/${integration.pageId}/leadgen_forms?access_token=${integration.pageAccessToken}`;

    console.log("[Facebook Lead Forms] Fetching forms from Facebook");

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Facebook Lead Forms] Error response:", response.status, errorText);
      return safeJson(
        { error: "Failed to fetch forms from Facebook" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const forms = data.data || [];

    console.log(`[Facebook Lead Forms] Fetched ${forms.length} forms`);

    // For each form, get or create a config
    const formConfigs = await Promise.all(
      forms.map(async (form: any) => {
        const existingConfig = await prisma.facebookLeadFormConfig.findUnique({
          where: {
            pageIntegrationId_formId: {
              pageIntegrationId: integration.id,
              formId: form.id,
            },
          },
        });

        if (existingConfig) {
          return existingConfig;
        }

        // Create a new config for this form
        return await prisma.facebookLeadFormConfig.create({
          data: {
            pageIntegrationId: integration.id,
            formId: form.id,
            formName: form.name || `Form ${form.id}`,
            flowId: "", // No flow selected by default
            tags: "[]",
            isActive: false, // Inactive until user configures it
          },
        });
      })
    );

    return safeJson({
      forms: formConfigs,
      integration,
    });
  } catch (error) {
    console.error("[Facebook Lead Forms] Error:", error);
    return safeJson(
      { error: "Failed to fetch lead forms" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/integrations/facebook/lead-forms
 * Update a lead form configuration
 * Body: { formId, flowId, tags, isActive }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { formId, flowId, tags, isActive } = body;

    if (!formId) {
      return safeJson(
        { error: "formId is required" },
        { status: 400 }
      );
    }

    // Get the connected page integration
    const integration = await prisma.facebookPageIntegration.findFirst();

    if (!integration) {
      return safeJson(
        { error: "No Facebook page connected" },
        { status: 404 }
      );
    }

    // Update the form config
    const config = await prisma.facebookLeadFormConfig.update({
      where: {
        pageIntegrationId_formId: {
          pageIntegrationId: integration.id,
          formId,
        },
      },
      data: {
        flowId: flowId || undefined,
        tags: tags ? JSON.stringify(tags) : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        updatedAt: new Date(),
      },
    });

    return safeJson({ config });
  } catch (error) {
    console.error("[Facebook Lead Forms] Error updating config:", error);
    return safeJson(
      { error: "Failed to update form configuration" },
      { status: 500 }
    );
  }
}
