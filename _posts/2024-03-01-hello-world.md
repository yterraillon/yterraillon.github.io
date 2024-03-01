---
layout: post
title:  "First Post"
date:   2024-03-01 11:20:00 +0100
categories: hello-world
tag: learning
---

Hello World

{% for tag in site.tags %}
  <h3>{{ tag[0] }}</h3>
  <ul>
    {% for post in tag[1] %}
      <li><a href="{{ post.url }}">{{ post.title }}</a></li>
    {% endfor %}
  </ul>
{% endfor %}