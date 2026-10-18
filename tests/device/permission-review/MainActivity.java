package com.nitesh.rhenium.linkdemo;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

/** Separate, permission-free receiver for a browser's external link handoff. */
public final class MainActivity extends Activity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(48, 48, 48, 48);
        layout.setBackgroundColor(0xff142321);
        TextView title = new TextView(this);
        title.setText("Opened in another installed app");
        title.setTextColor(0xffedf5ef);
        title.setTextSize(32);
        layout.addView(title);
        TextView details = new TextView(this);
        details.setText("Rhenium Link Demo\nReceived link: " + getIntent().getDataString()
                + "\n\nThis separate review fixture requests no permissions.");
        details.setTextSize(22);
        details.setTextColor(0xffc0d1c8);
        details.setGravity(Gravity.CENTER);
        details.setPadding(0, 24, 0, 24);
        layout.addView(details);
        Button close = new Button(this);
        close.setText("Return to browser");
        close.setOnClickListener(view -> finish());
        layout.addView(close);
        setContentView(layout);
        close.requestFocus();
    }
}
