#pragma once

#include <Arduino.h>

namespace DiagPage {

/** Página de diagnóstico (HTML estático; los datos llegan por /api/diag). */
const char* html();

}  // namespace DiagPage
