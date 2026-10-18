package com.nitesh.rhenium.installdemo;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** No-permission fixture for demonstrating a real Android package installation. */
public final class MainActivity extends Activity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        content.setPadding(48, 48, 48, 48);
        content.setBackgroundColor(0xff142321);
        TextView title = new TextView(this);
        title.setText("Installation confirmed");
        title.setTextColor(0xffeaf4ed);
        title.setTextSize(32);
        content.addView(title);
        TextView description = new TextView(this);
        description.setText("Rhenium Install Demo\n\nThis is a test APK for the permission review.\nIt requests no permissions and uses no network or accounts.");
        description.setTextColor(0xffc0d1c8);
        description.setTextSize(20);
        description.setGravity(Gravity.CENTER);
        description.setPadding(0, 24, 0, 24);
        content.addView(description);
        Button close = new Button(this);
        close.setText("Close demo");
        close.setOnClickListener(view -> finish());
        content.addView(close);
        setContentView(content);
        close.requestFocus();
    }
}
