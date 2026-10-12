// Force-included by build.rs for MI firmware compiled with -DTEST.
// plaits/user_data.h uses printf in flash mocks without including <cstdio>.
#pragma once
#include <cstdio>
