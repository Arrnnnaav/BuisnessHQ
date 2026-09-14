<?php
/**
 * Plugin Name: BusinessOS Staging Connector
 * Description: Least-privilege staging-only SEO draft connector for BusinessOS.
 * Version: 0.1.0
 */

if (!defined('ABSPATH')) { exit; }

const BUSINESSOS_API_NAMESPACE = 'businessos/v1';
const BUSINESSOS_CAPABILITY = 'businessos_manage_drafts';

register_activation_hook(__FILE__, function () {
    add_role('businessos_connector', 'BusinessOS Connector', [
        'read' => true,
        BUSINESSOS_CAPABILITY => true,
    ]);
});

function businessos_is_staging() {
    return defined('BUSINESSOS_STAGING_SITE') && BUSINESSOS_STAGING_SITE === true;
}

function businessos_can_read() {
    return is_user_logged_in() && current_user_can(BUSINESSOS_CAPABILITY);
}

function businessos_can_write() {
    return businessos_is_staging() && businessos_can_read();
}

function businessos_meta_description($post_id) {
    foreach (['_businessos_meta_description', '_yoast_wpseo_metadesc', 'rank_math_description'] as $key) {
        $value = get_post_meta($post_id, $key, true);
        if ($value !== '') { return $value; }
    }
    return '';
}

function businessos_draft_payload($post) {
    return [
        'id' => $post->ID,
        'status' => $post->post_status,
        'title' => $post->post_title,
        'content' => $post->post_content,
        'meta_description' => businessos_meta_description($post->ID),
        'managed' => (bool) get_post_meta($post->ID, '_businessos_managed', true),
        'tenant_id' => get_post_meta($post->ID, '_businessos_tenant_id', true),
        'experiment_id' => get_post_meta($post->ID, '_businessos_experiment_id', true),
        'request_id' => get_post_meta($post->ID, '_businessos_request_id', true),
        'created_at' => get_post_meta($post->ID, '_businessos_created_at', true),
    ];
}

function businessos_require_owned_draft($post_id) {
    $post = get_post($post_id);
    if (!$post || $post->post_status !== 'draft' || !get_post_meta($post_id, '_businessos_managed', true)) {
        return new WP_Error('businessos_forbidden', 'Only BusinessOS-created drafts may be modified.', ['status' => 403]);
    }
    return $post;
}

add_action('rest_api_init', function () {
    register_rest_route(BUSINESSOS_API_NAMESPACE, '/health', [
        'methods' => 'GET', 'permission_callback' => 'businessos_can_read',
        'callback' => fn() => ['ok' => true, 'staging' => businessos_is_staging(), 'version' => '0.1.0', 'capabilities' => ['page.read', 'draft.create', 'draft.update_owned']],
    ]);

    register_rest_route(BUSINESSOS_API_NAMESPACE, '/pages/(?P<id>\d+)/snapshot', [
        'methods' => 'GET', 'permission_callback' => 'businessos_can_read',
        'callback' => function ($request) {
            $post = get_post((int) $request['id']);
            if (!$post || !in_array($post->post_status, ['publish', 'draft'], true)) { return new WP_Error('not_found', 'Page not found.', ['status' => 404]); }
            return ['id' => $post->ID, 'url' => get_permalink($post), 'status' => $post->post_status, 'title' => $post->post_title, 'content' => $post->post_content, 'meta_description' => businessos_meta_description($post->ID), 'canonical' => get_permalink($post)];
        },
    ]);

    register_rest_route(BUSINESSOS_API_NAMESPACE, '/pages/(?P<id>\d+)/seo', [
        'methods' => 'GET', 'permission_callback' => 'businessos_can_read',
        'callback' => function ($request) { $post = get_post((int) $request['id']); if (!$post) { return new WP_Error('not_found', 'Page not found.', ['status' => 404]); } return ['id' => $post->ID, 'title' => $post->post_title, 'meta_description' => businessos_meta_description($post->ID), 'canonical' => get_permalink($post)]; },
    ]);

    register_rest_route(BUSINESSOS_API_NAMESPACE, '/drafts', [
        'methods' => 'POST', 'permission_callback' => 'businessos_can_write',
        'callback' => function ($request) {
            $payload = $request->get_json_params();
            if (($payload['status'] ?? '') !== 'draft') { return new WP_Error('draft_only', 'BusinessOS can create drafts only.', ['status' => 403]); }
            $source = get_post((int) ($payload['source_page_id'] ?? 0));
            if (!$source) { return new WP_Error('invalid_source', 'A valid source page is required.', ['status' => 400]); }
            $post_id = wp_insert_post(['post_type' => $source->post_type, 'post_status' => 'draft', 'post_title' => sanitize_text_field($payload['title'] ?? ''), 'post_content' => $source->post_content, 'post_excerpt' => $source->post_excerpt], true);
            if (is_wp_error($post_id)) { return $post_id; }
            update_post_meta($post_id, '_businessos_managed', true);
            update_post_meta($post_id, '_businessos_tenant_id', sanitize_text_field($payload['tenant_id'] ?? ''));
            update_post_meta($post_id, '_businessos_experiment_id', sanitize_text_field($payload['experiment_id'] ?? ''));
            update_post_meta($post_id, '_businessos_created_at', current_time('c', true));
            update_post_meta($post_id, '_businessos_request_id', wp_generate_uuid4());
            update_post_meta($post_id, '_businessos_source_page_id', $source->ID);
            update_post_meta($post_id, '_businessos_meta_description', sanitize_textarea_field($payload['meta_description'] ?? ''));
            update_post_meta($post_id, '_yoast_wpseo_metadesc', sanitize_textarea_field($payload['meta_description'] ?? ''));
            update_post_meta($post_id, 'rank_math_description', sanitize_textarea_field($payload['meta_description'] ?? ''));
            return new WP_REST_Response(businessos_draft_payload(get_post($post_id)), 201);
        },
    ]);

    register_rest_route(BUSINESSOS_API_NAMESPACE, '/drafts/(?P<id>\d+)', [
        ['methods' => 'GET', 'permission_callback' => 'businessos_can_read', 'callback' => function ($request) { $post = businessos_require_owned_draft((int) $request['id']); return is_wp_error($post) ? $post : businessos_draft_payload($post); }],
        ['methods' => 'PUT', 'permission_callback' => 'businessos_can_write', 'callback' => function ($request) {
            $post = businessos_require_owned_draft((int) $request['id']); if (is_wp_error($post)) { return $post; }
            $payload = $request->get_json_params(); if (($payload['status'] ?? 'draft') !== 'draft') { return new WP_Error('draft_only', 'Publishing is disabled.', ['status' => 403]); }
            wp_update_post(['ID' => $post->ID, 'post_status' => 'draft', 'post_title' => sanitize_text_field($payload['title'] ?? $post->post_title)]);
            if (isset($payload['meta_description'])) { update_post_meta($post->ID, '_businessos_meta_description', sanitize_textarea_field($payload['meta_description'])); update_post_meta($post->ID, '_yoast_wpseo_metadesc', sanitize_textarea_field($payload['meta_description'])); update_post_meta($post->ID, 'rank_math_description', sanitize_textarea_field($payload['meta_description'])); }
            return businessos_draft_payload(get_post($post->ID));
        }],
    ]);

    register_rest_route(BUSINESSOS_API_NAMESPACE, '/rollback', [
        'methods' => 'POST', 'permission_callback' => 'businessos_can_write',
        'callback' => function ($request) {
            $payload = $request->get_json_params(); $post = businessos_require_owned_draft((int) ($payload['draft_id'] ?? 0)); if (is_wp_error($post)) { return $post; }
            $snapshot = $payload['snapshot'] ?? []; wp_update_post(['ID' => $post->ID, 'post_status' => 'draft', 'post_title' => sanitize_text_field($snapshot['title'] ?? $post->post_title)]);
            if (isset($snapshot['meta_description'])) { update_post_meta($post->ID, '_businessos_meta_description', sanitize_textarea_field($snapshot['meta_description'])); update_post_meta($post->ID, '_yoast_wpseo_metadesc', sanitize_textarea_field($snapshot['meta_description'])); update_post_meta($post->ID, 'rank_math_description', sanitize_textarea_field($snapshot['meta_description'])); }
            return businessos_draft_payload(get_post($post->ID));
        },
    ]);
});
