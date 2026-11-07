
package com.tooshyta.novaai;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.content.Intent;
import android.net.Uri;
import android.graphics.Color;

public class MainActivity extends Activity {

    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private static final int FILE_REQUEST = 1001;

    private final String NOVA_URL =
            "https://nova-ai-frontend-yhuy.onrender.com/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // السماح للنظام بإظهار أشرطة الحالة والتنقل
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(true);
        }

        getWindow().clearFlags(
                WindowManager.LayoutParams.FLAG_FULLSCREEN
        );

        getWindow().setStatusBarColor(Color.rgb(23, 23, 23));
        getWindow().setNavigationBarColor(Color.rgb(23, 23, 23));

        getWindow().getDecorView().setSystemUiVisibility(0);

        getWindow().setSoftInputMode(
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        );

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params) {

                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }

                fileCallback = callback;

                Intent intent = params.createIntent();

                try {
                    startActivityForResult(intent, FILE_REQUEST);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }

                return true;
            }
        });

        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);

        webView.loadUrl(NOVA_URL);
    }

    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {

        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_REQUEST && fileCallback != null) {

            Uri[] results = null;

            if (resultCode == RESULT_OK && data != null) {
                Uri uri = data.getData();

                if (uri != null) {
                    results = new Uri[]{uri};
                }
            }

            fileCallback.onReceiveValue(results);
            fileCallback = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
